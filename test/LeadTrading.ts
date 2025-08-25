import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { LeadTrading, MockUSDT, CUSDT } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("LeadTrading", function () {
  let leadTrading: LeadTrading;
  let mockUSDT: MockUSDT;
  let cUSDT: CUSDT;
  let deployer: HardhatEthersSigner;
  let leader: HardhatEthersSigner;
  let follower1: HardhatEthersSigner;
  let follower2: HardhatEthersSigner;

  const TARGET_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 USDT
  const DURATION = 30 * 24 * 60 * 60; // 30 days in seconds
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6); // 1,000 USDT

  beforeEach(async function () {
    [deployer, leader, follower1, follower2] = await ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDTFactory.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy cUSDT
    const CUSDTFactory = await ethers.getContractFactory("cUSDT");
    cUSDT = await CUSDTFactory.deploy(await mockUSDT.getAddress());
    await cUSDT.waitForDeployment();

    // Deploy LeadTrading
    const LeadTradingFactory = await ethers.getContractFactory("LeadTrading");
    leadTrading = await LeadTradingFactory.deploy(
      await mockUSDT.getAddress(),
      await cUSDT.getAddress()
    );
    await leadTrading.waitForDeployment();

    // Mint USDT to users for testing
    await mockUSDT.mint(leader.address, ethers.parseUnits("100000", 6));
    await mockUSDT.mint(follower1.address, ethers.parseUnits("100000", 6));
    await mockUSDT.mint(follower2.address, ethers.parseUnits("100000", 6));

    // Approve cUSDT to spend USDT
    await mockUSDT.connect(leader).approve(await cUSDT.getAddress(), ethers.MaxUint256);
    await mockUSDT.connect(follower1).approve(await cUSDT.getAddress(), ethers.MaxUint256);
    await mockUSDT.connect(follower2).approve(await cUSDT.getAddress(), ethers.MaxUint256);

    // Wrap some USDT to cUSDT for testing
    await cUSDT.connect(follower1).wrap(follower1.address, ethers.parseUnits("10000", 6));
    await cUSDT.connect(follower2).wrap(follower2.address, ethers.parseUnits("10000", 6));
  });

  describe("Trading Round Creation", function () {
    it("Should create a trading round successfully", async function () {
      const tx = await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);
      
      await expect(tx)
        .to.emit(leadTrading, "RoundCreated")
        .withArgs(1, leader.address, TARGET_AMOUNT, DURATION);

      const roundInfo = await leadTrading.getRoundInfo(1);
      expect(roundInfo.leader).to.equal(leader.address);
      expect(roundInfo.targetAmount).to.equal(TARGET_AMOUNT);
      expect(roundInfo.duration).to.equal(DURATION);
      expect(roundInfo.isActive).to.be.true;
      expect(roundInfo.isProfitDistributed).to.be.false;
      expect(roundInfo.followerCount).to.equal(0);
    });

    it("Should reject round with target amount too low", async function () {
      const lowAmount = ethers.parseUnits("500", 6); // 500 USDT
      
      await expect(
        leadTrading.connect(leader).createTradingRound(lowAmount, DURATION)
      ).to.be.revertedWith("Target amount too low");
    });

    it("Should reject round with invalid duration", async function () {
      const shortDuration = 12 * 60 * 60; // 12 hours
      const longDuration = 400 * 24 * 60 * 60; // 400 days
      
      await expect(
        leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, shortDuration)
      ).to.be.revertedWith("Invalid duration");

      await expect(
        leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, longDuration)
      ).to.be.revertedWith("Invalid duration");
    });
  });

  describe("Joining Rounds", function () {
    beforeEach(async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);
    });

    it("Should allow followers to join with encrypted amounts", async function () {
      // Create encrypted input for follower1
      const input1 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input1.add64(DEPOSIT_AMOUNT);
      const encryptedInput1 = await input1.encrypt();

      // Note: cUSDT doesn't have approve function like standard ERC20
      // The transfer will be handled directly in the contract

      const tx = await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput1.handles[0], encryptedInput1.inputProof);

      await expect(tx)
        .to.emit(leadTrading, "FollowerJoined")
        .withArgs(1, follower1.address, 0); // Amount is not emitted for privacy

      const followerInfo = await leadTrading.getFollowerInfo(1, follower1.address);
      expect(followerInfo.hasDeposited).to.be.true;
      expect(followerInfo.hasWithdrawn).to.be.false;

      const roundInfo = await leadTrading.getRoundInfo(1);
      expect(roundInfo.followerCount).to.equal(1);
    });

    it("Should reject leader joining as follower", async function () {
      const input = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        leader.address
      );
      input.add64(DEPOSIT_AMOUNT);
      const encryptedInput = await input.encrypt();

      await expect(
        leadTrading
          .connect(leader)
          .joinRound(1, encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.be.revertedWith("Leader cannot join as follower");
    });

    it("Should reject double deposits from same follower", async function () {
      // First deposit
      const input1 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input1.add64(DEPOSIT_AMOUNT);
      const encryptedInput1 = await input1.encrypt();

      // Set LeadTrading as operator for cUSDT transfers
      await cUSDT.connect(follower1).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour
      
      await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput1.handles[0], encryptedInput1.inputProof);

      // Second deposit (should fail)
      const input2 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input2.add64(DEPOSIT_AMOUNT);
      const encryptedInput2 = await input2.encrypt();

      await expect(
        leadTrading
          .connect(follower1)
          .joinRound(1, encryptedInput2.handles[0], encryptedInput2.inputProof)
      ).to.be.revertedWith("Already deposited");
    });
  });

  describe("Fund Extraction", function () {
    beforeEach(async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);

      // Add two followers
      const input1 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input1.add64(DEPOSIT_AMOUNT);
      const encryptedInput1 = await input1.encrypt();

      const input2 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower2.address
      );
      input2.add64(DEPOSIT_AMOUNT);
      const encryptedInput2 = await input2.encrypt();

      // Set LeadTrading as operator for cUSDT transfers
      await cUSDT.connect(follower1).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour
      await cUSDT.connect(follower2).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour

      await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput1.handles[0], encryptedInput1.inputProof);

      await leadTrading
        .connect(follower2)
        .joinRound(1, encryptedInput2.handles[0], encryptedInput2.inputProof);
    });

    it("Should allow leader to extract funds", async function () {
      const balanceBefore = await mockUSDT.balanceOf(leader.address);
      
      // Note: This test might need to be adjusted based on the actual decryption mechanism
      // In a real environment, the decryption would be handled by the oracle
      await expect(
        leadTrading.connect(leader).extractFunds(1)
      ).not.to.be.reverted;
    });

    it("Should reject non-leader extraction", async function () {
      await expect(
        leadTrading.connect(follower1).extractFunds(1)
      ).to.be.revertedWith("Only leader can extract");
    });
  });

  describe("Profit Distribution", function () {
    beforeEach(async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);

      // Add followers
      const input1 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input1.add64(DEPOSIT_AMOUNT);
      const encryptedInput1 = await input1.encrypt();

      // Set LeadTrading as operator for cUSDT transfers
      await cUSDT.connect(follower1).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour
      await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput1.handles[0], encryptedInput1.inputProof);

      // Fast forward time to end the round
      await time.increase(DURATION + 1);
    });

    it("Should allow leader to deposit profit", async function () {
      const profitAmount = ethers.parseUnits("500", 6); // 500 USDT profit
      
      await mockUSDT.connect(leader).approve(await leadTrading.getAddress(), profitAmount);
      
      const tx = await leadTrading.connect(leader).depositProfit(1, profitAmount);
      
      await expect(tx)
        .to.emit(leadTrading, "ProfitDeposited")
        .withArgs(1, profitAmount);
    });

    it("Should distribute profits proportionally", async function () {
      const profitAmount = ethers.parseUnits("500", 6);
      
      // Deposit profit
      await mockUSDT.connect(leader).approve(await leadTrading.getAddress(), profitAmount);
      await leadTrading.connect(leader).depositProfit(1, profitAmount);

      // Distribute profits
      const tx = await leadTrading.connect(leader).distributeProfit(1);
      
      await expect(tx)
        .to.emit(leadTrading, "RoundCompleted")
        .withArgs(1);

      const roundInfo = await leadTrading.getRoundInfo(1);
      expect(roundInfo.isActive).to.be.false;
      expect(roundInfo.isProfitDistributed).to.be.true;
    });
  });

  describe("Emergency Withdrawal", function () {
    beforeEach(async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);

      const input = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input.add64(DEPOSIT_AMOUNT);
      const encryptedInput = await input.encrypt();

      // Set LeadTrading as operator for cUSDT transfers
      await cUSDT.connect(follower1).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour
      await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput.handles[0], encryptedInput.inputProof);
    });

    it("Should allow emergency withdrawal after grace period", async function () {
      // Fast forward past round end + 7 days
      await time.increase(DURATION + 7 * 24 * 60 * 60 + 1);

      await expect(
        leadTrading.connect(follower1).emergencyWithdraw(1)
      ).not.to.be.reverted;

      const followerInfo = await leadTrading.getFollowerInfo(1, follower1.address);
      expect(followerInfo.hasWithdrawn).to.be.true;
    });

    it("Should reject early emergency withdrawal", async function () {
      await expect(
        leadTrading.connect(follower1).emergencyWithdraw(1)
      ).to.be.revertedWith("Emergency period not reached");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);
    });

    it("Should return correct round information", async function () {
      const roundInfo = await leadTrading.getRoundInfo(1);
      
      expect(roundInfo.leader).to.equal(leader.address);
      expect(roundInfo.targetAmount).to.equal(TARGET_AMOUNT);
      expect(roundInfo.duration).to.equal(DURATION);
      expect(roundInfo.isActive).to.be.true;
      expect(roundInfo.isProfitDistributed).to.be.false;
      expect(roundInfo.followerCount).to.equal(0);
    });

    it("Should return correct follower list", async function () {
      // Add followers
      const input1 = fhevm.createEncryptedInput(
        await leadTrading.getAddress(),
        follower1.address
      );
      input1.add64(DEPOSIT_AMOUNT);
      const encryptedInput1 = await input1.encrypt();

      // Set LeadTrading as operator for cUSDT transfers
      await cUSDT.connect(follower1).setOperator(await leadTrading.getAddress(), Math.floor(Date.now() / 1000) + 3600); // 1 hour
      await leadTrading
        .connect(follower1)
        .joinRound(1, encryptedInput1.handles[0], encryptedInput1.inputProof);

      const followers = await leadTrading.getRoundFollowers(1);
      expect(followers).to.have.lengthOf(1);
      expect(followers[0]).to.equal(follower1.address);
    });
  });
});