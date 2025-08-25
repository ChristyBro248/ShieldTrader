import { expect } from "chai";
import { ethers } from "hardhat";
import { LeadTrading, MockUSDT, CUSDT } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("LeadTrading - Simple Tests", function () {
  let leadTrading: LeadTrading;
  let mockUSDT: MockUSDT;
  let cUSDT: CUSDT;
  let deployer: HardhatEthersSigner;
  let leader: HardhatEthersSigner;
  let follower1: HardhatEthersSigner;

  const TARGET_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 USDT
  const DURATION = 30 * 24 * 60 * 60; // 30 days in seconds

  beforeEach(async function () {
    [deployer, leader, follower1] = await ethers.getSigners();

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
  });

  describe("Contract Deployment", function () {
    it("Should deploy contracts successfully", async function () {
      expect(await leadTrading.getAddress()).to.not.be.undefined;
      expect(await mockUSDT.getAddress()).to.not.be.undefined;
      expect(await cUSDT.getAddress()).to.not.be.undefined;
    });

    it("Should have correct initial balances", async function () {
      const leaderBalance = await mockUSDT.balanceOf(leader.address);
      const followerBalance = await mockUSDT.balanceOf(follower1.address);
      
      expect(leaderBalance).to.equal(ethers.parseUnits("100000", 6));
      expect(followerBalance).to.equal(ethers.parseUnits("100000", 6));
    });
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

    it("Should return empty follower list initially", async function () {
      const followers = await leadTrading.getRoundFollowers(1);
      expect(followers).to.have.lengthOf(0);
    });

    it("Should return current round ID", async function () {
      const currentRoundId = await leadTrading.currentRoundId();
      expect(currentRoundId).to.equal(1);
    });
  });

  describe("USDT Token Operations", function () {
    it("Should allow wrapping USDT to cUSDT", async function () {
      const wrapAmount = ethers.parseUnits("1000", 6);
      
      // Approve cUSDT to spend USDT
      await mockUSDT.connect(follower1).approve(await cUSDT.getAddress(), wrapAmount);
      
      // Wrap USDT to cUSDT
      await cUSDT.connect(follower1).wrap(follower1.address, wrapAmount);
      
      // Check balances
      const usdtBalance = await mockUSDT.balanceOf(follower1.address);
      expect(usdtBalance).to.equal(ethers.parseUnits("99000", 6)); // 100000 - 1000
    });
  });

  describe("Access Control", function () {
    it("Should reject non-leader operations", async function () {
      await leadTrading.connect(leader).createTradingRound(TARGET_AMOUNT, DURATION);

      // Test extractFunds
      await expect(
        leadTrading.connect(follower1).extractFunds(1)
      ).to.be.revertedWith("Only leader can extract");

      // Test depositProfit
      await expect(
        leadTrading.connect(follower1).depositProfit(1, 1000)
      ).to.be.revertedWith("Only leader can deposit profit");
    });
  });
});