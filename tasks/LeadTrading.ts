import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("deploy-lead-trading", "Deploy LeadTrading contracts")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { deployer } = await hre.getNamedAccounts();
    const { deploy } = hre.deployments;

    console.log("Deploying contracts with the account:", deployer);

    // Deploy cUSDT (ConfidentialFungibleToken)
    const cUSDT = await deploy("cUSDT", {
      from: deployer,
      args: [],
      log: true,
    });

    // Deploy LeadTrading
    const leadTrading = await deploy("LeadTrading", {
      from: deployer,
      args: [cUSDT.address],
      log: true,
    });

    console.log("Deployment completed!");
    console.log("cUSDT:", cUSDT.address);
    console.log("LeadTrading:", leadTrading.address);
  });

task("create-round", "Create a new trading round")
  .addParam("target", "Target amount in USDT (without decimals)")
  .addParam("duration", "Duration in days")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);

    const targetAmount = hre.ethers.parseUnits(taskArgs.target, 6);
    const duration = parseInt(taskArgs.duration) * 24 * 60 * 60; // Convert days to seconds

    console.log(`Creating trading round with target: ${taskArgs.target} USDT, duration: ${taskArgs.duration} days`);
    
    const tx = await leadTrading.connect(signer).createTradingRound(targetAmount, duration);
    const receipt = await tx.wait();
    
    console.log("Trading round created successfully!");
    console.log("Transaction hash:", tx.hash);
    
    // Get the round ID from events
    const event = receipt?.logs.find((log: any) => 
      log.topics[0] === hre.ethers.id("RoundCreated(uint256,address,uint256,uint256)")
    );
    
    if (event) {
      const roundId = hre.ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256", "address", "uint256", "uint256"],
        event.data
      )[0];
      console.log("Round ID:", roundId.toString());
    }
  });

task("join-round", "Join a trading round")
  .addParam("roundid", "Round ID to join")
  .addParam("amount", "Amount to deposit in USDT (without decimals)")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    const cUSDTAddress = (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);

    const amount = hre.ethers.parseUnits(taskArgs.amount, 6);
    
    console.log(`Joining round ${taskArgs.roundid} with ${taskArgs.amount} USDT`);
    
    // Create encrypted input
    const input = hre.fhevm.createEncryptedInput(contractAddress, signer.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();
    
    // Set contract as operator for cUSDT transfers
    const operatorTx = await cUSDT.connect(signer).setOperator(contractAddress, Math.floor(Date.now() / 1000) + 3600);
    await operatorTx.wait();
    console.log("Set LeadTrading as operator");
    
    // Join round
    const tx = await leadTrading
      .connect(signer)
      .joinRound(taskArgs.roundid, encryptedInput.handles[0], encryptedInput.inputProof);
    
    await tx.wait();
    console.log("Successfully joined round!");
    console.log("Transaction hash:", tx.hash);
  });

task("round-info", "Get information about a trading round")
  .addParam("roundid", "Round ID to query")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    const roundInfo = await leadTrading.getRoundInfo(taskArgs.roundid);
    const followers = await leadTrading.getRoundFollowers(taskArgs.roundid);
    
    console.log("=== Round Information ===");
    console.log("Round ID:", taskArgs.roundid);
    console.log("Leader:", roundInfo.leader);
    console.log("Target Amount:", hre.ethers.formatUnits(roundInfo.targetAmount, 6), "USDT");
    console.log("Duration:", roundInfo.duration.toString(), "seconds");
    console.log("Start Time:", new Date(Number(roundInfo.startTime) * 1000).toISOString());
    console.log("End Time:", new Date(Number(roundInfo.endTime) * 1000).toISOString());
    console.log("Is Active:", roundInfo.isActive);
    console.log("Profit Distributed:", roundInfo.isProfitDistributed);
    console.log("Deposits Enabled:", roundInfo.depositsEnabled);
    console.log("Follower Count:", roundInfo.followerCount.toString());
    console.log("Unit Profit Rate:", roundInfo.unitProfitRate.toString());
    console.log("Decrypted Total Deposited:", hre.ethers.formatUnits(roundInfo.decryptedTotalDeposited, 6), "USDT");
    console.log("Decrypted Total Profit:", hre.ethers.formatUnits(roundInfo.decryptedTotalProfit, 6), "USDT");
    console.log("Followers:", followers);
  });

task("mint-cusdt", "Mint cUSDT tokens for testing")
  .addParam("amount", "Amount to mint (without decimals)")
  .addOptionalParam("to", "Address to mint to (defaults to signer)")
  .addOptionalParam("contract", "cUSDT contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", contractAddress);
    
    const to = taskArgs.to || signer.address;
    const amount = hre.ethers.parseUnits(taskArgs.amount, 6);
    
    console.log(`Minting ${taskArgs.amount} cUSDT to ${to}`);
    
    const tx = await cUSDT.mint(to, amount);
    await tx.wait();
    
    console.log("cUSDT minted successfully!");
    console.log("Transaction hash:", tx.hash);
  });

task("extract-funds", "Extract funds from a round (leader only, after stopping deposits)")
  .addParam("roundid", "Round ID to extract from")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    console.log(`Extracting funds from round ${taskArgs.roundid}`);
    console.log("Note: Deposits must be stopped first using stop-deposits task");
    
    const tx = await leadTrading.connect(signer).extractFunds(taskArgs.roundid);
    await tx.wait();
    
    console.log("Funds extracted successfully!");
    console.log("Transaction hash:", tx.hash);
  });

task("deposit-profit", "Deposit profit to a round (leader only)")
  .addParam("roundid", "Round ID to deposit to")
  .addParam("amount", "Profit amount in cUSDT (without decimals)")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    const cUSDTAddress = (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);

    const amount = hre.ethers.parseUnits(taskArgs.amount, 6);
    
    console.log(`Depositing ${taskArgs.amount} cUSDT profit to round ${taskArgs.roundid}`);
    
    // Create encrypted input
    const input = hre.fhevm.createEncryptedInput(contractAddress, signer.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();
    
    // Set contract as operator for cUSDT transfers
    const operatorTx = await cUSDT.connect(signer).setOperator(contractAddress, Math.floor(Date.now() / 1000) + 3600);
    await operatorTx.wait();
    console.log("Set LeadTrading as operator for cUSDT");
    
    // Deposit profit
    const tx = await leadTrading
      .connect(signer)
      .depositProfit(taskArgs.roundid, encryptedInput.handles[0], encryptedInput.inputProof);
    
    await tx.wait();
    
    console.log("Profit deposited successfully!");
    console.log("Transaction hash:", tx.hash);
  });

task("distribute-profit", "Distribute profit to followers")
  .addParam("roundid", "Round ID to distribute profit for")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    console.log(`Distributing profit for round ${taskArgs.roundid}`);
    
    const tx = await leadTrading.connect(signer).distributeProfit(taskArgs.roundid);
    await tx.wait();
    
    console.log("Profit distributed successfully!");
    console.log("Transaction hash:", tx.hash);
  });

task("stop-deposits", "Stop accepting new deposits for a round (leader only)")
  .addParam("roundid", "Round ID to stop deposits for")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    console.log(`Stopping deposits for round ${taskArgs.roundid}`);
    
    const tx = await leadTrading.connect(signer).stopDeposits(taskArgs.roundid);
    await tx.wait();
    
    console.log("Deposits stopped successfully!");
    console.log("Transaction hash:", tx.hash);
  });

task("withdraw-profit", "Withdraw profit from a round (follower)")
  .addParam("roundid", "Round ID to withdraw from")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    console.log(`Withdrawing profit from round ${taskArgs.roundid}`);
    
    const tx = await leadTrading.connect(signer).withdrawProfit(taskArgs.roundid);
    await tx.wait();
    
    console.log("Profit withdrawal initiated successfully!");
    console.log("Transaction hash:", tx.hash);
    console.log("Note: Actual transfer will occur after decryption callback");
  });

task("leader-rounds", "Get all rounds created by a leader")
  .addParam("leader", "Leader address")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    const rounds = await leadTrading.getLeaderRounds(taskArgs.leader);
    const roundCount = await leadTrading.getLeaderRoundsCount(taskArgs.leader);
    
    console.log(`=== Leader ${taskArgs.leader} Rounds ===`);
    console.log("Total Rounds:", roundCount.toString());
    console.log("Round IDs:", rounds.map(r => r.toString()));
    
    // Get detailed info for each round
    for (const roundId of rounds) {
      const roundInfo = await leadTrading.getRoundInfo(roundId);
      console.log(`\n--- Round ${roundId} ---`);
      console.log("Target Amount:", hre.ethers.formatUnits(roundInfo.targetAmount, 6), "USDT");
      console.log("Is Active:", roundInfo.isActive);
      console.log("Deposits Enabled:", roundInfo.depositsEnabled);
      console.log("Profit Distributed:", roundInfo.isProfitDistributed);
      console.log("Followers:", roundInfo.followerCount.toString());
      if (roundInfo.decryptedTotalDeposited > 0) {
        console.log("Total Deposited:", hre.ethers.formatUnits(roundInfo.decryptedTotalDeposited, 6), "cUSDT");
      }
      if (roundInfo.decryptedTotalProfit > 0) {
        console.log("Total Profit:", hre.ethers.formatUnits(roundInfo.decryptedTotalProfit, 6), "cUSDT");
      }
    }
  });