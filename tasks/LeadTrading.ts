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
    await tx.wait();

    console.log("Trading round created successfully!");
    console.log("Transaction hash:", tx.hash);

    // Safest: read from storage
    const roundId = await leadTrading.currentRoundId();
    console.log("Round ID:", roundId.toString());
  });

task("join-round", "Join a trading round")
  .addParam("roundid", "Round ID to join")
  .addParam("amount", "Amount to deposit in USDT (without decimals)")
  .addOptionalParam("contract", "LeadTrading contract address")
  .addOptionalParam("account", "Account index to use (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const accountIndex = parseInt(taskArgs.account || "0");
    const signer = signers[accountIndex];
    await hre.fhevm.initializeCLIApi();
    
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const leadTrading = await hre.ethers.getContractAt("LeadTrading", contractAddress);
    
    // const cUSDTAddress = (await hre.deployments.get("cUSDT")).address;
    // const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);

    const amount = hre.ethers.parseUnits(taskArgs.amount, 6);
    
    console.log(`Joining round ${taskArgs.roundid} with ${taskArgs.amount} USDT`);
    
    // Authorize contract as operator to spend encrypted funds (required by CFT)
    // const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24h
    // const opTx = await cUSDT.connect(signer).setOperator(contractAddress, until);
    // await opTx.wait();

    // Create encrypted input
    const input = hre.fhevm.createEncryptedInput(contractAddress, signer.address);
    input.add64(amount);
    const encryptedInput = await input.encrypt();
    
    // Join round (the contract handles cUSDT transfers internally)
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

// Removed obsolete MockUSDT minter task; use cUSDT faucet instead.

task("set-operator", "Authorize LeadTrading to spend caller's cUSDT for 24h")
  .addOptionalParam("contract", "LeadTrading contract address")
  .addOptionalParam("account", "Account index to use (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const accountIndex = parseInt(taskArgs.account || "0");
    const signer = signers[accountIndex];

    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const cUSDTAddress = (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);

    const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    console.log(`Setting operator: ${contractAddress} until ${until} for ${signer.address}`);
    const tx = await cUSDT.connect(signer).setOperator(contractAddress, until);
    await tx.wait();
    console.log("Operator set. Tx:", tx.hash);
  });

task("cft-status", "Show cUSDT operator and balance for an account")
  .addOptionalParam("account", "Account index to inspect (default: 1)")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const i = parseInt(taskArgs.account || "1");
    const user = signers[i];
    const contractAddress = taskArgs.contract || (await hre.deployments.get("LeadTrading")).address;
    const cUSDTAddress = (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);

    const isOp = await cUSDT.isOperator(user.address, contractAddress);
    const bal = await cUSDT.confidentialBalanceOf(user.address);
    console.log("Account:", user.address);
    console.log("LeadTrading:", contractAddress);
    console.log("Operator set:", isOp);
    console.log("cUSDT balance:", hre.ethers.formatUnits(bal, 6));
  });

task("faucet-cusdt", "Claim 1000 cUSDT tokens from faucet")
  .addOptionalParam("contract", "cUSDT contract address")
  .addOptionalParam("account", "Account index to use (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const accountIndex = parseInt(taskArgs.account || "0");
    const signer = signers[accountIndex];
    
    const cUSDTAddress = taskArgs.contract || (await hre.deployments.get("cUSDT")).address;
    const cUSDT = await hre.ethers.getContractAt("cUSDT", cUSDTAddress);
    
    console.log(`Claiming 1000 cUSDT tokens for account ${signer.address}`);
    
    try {
      const tx = await cUSDT.connect(signer).faucet();
      await tx.wait();
      
      console.log("Successfully claimed 1000 cUSDT tokens!");
      console.log("Transaction hash:", tx.hash);
      console.log("\nNote: These are encrypted cUSDT tokens that can be used directly in trading rounds");
      
    } catch (error: any) {
      if (error.message?.includes("revert")) {
        console.error("Failed to claim tokens. Possible reasons:");
        console.error("- You may have already claimed recently (24 hour cooldown)");
        console.error("- Contract may be out of funds");
        console.error("- Network connection issues");
      } else {
        console.error("Error claiming cUSDT tokens:", error.message);
      }
    }
  });

task("extract-funds", "Extract funds from a round (leader only, after stopping deposits)")
  .addParam("roundid", "Round ID to extract from")
  .addOptionalParam("contract", "LeadTrading contract address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    await hre.fhevm.initializeCLIApi();
    
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
    await hre.fhevm.initializeCLIApi()
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
    
    // Deposit profit (contract handles cUSDT transfers internally)
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
  .addOptionalParam("account", "Account index to use (default: 0)")
  .setAction(async (taskArgs, hre) => {
    const signers = await hre.ethers.getSigners();
    const accountIndex = taskArgs.account ? parseInt(taskArgs.account) : 0;
    const signer = signers[accountIndex];
    
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
