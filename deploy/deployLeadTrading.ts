import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployLeadTrading: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("Deploying contracts with the account:", deployer);

  // Deploy cUSDT (confidential USDT wrapper)
  const cUSDT = await deploy("cUSDT", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log("cUSDT deployed to:", cUSDT.address);

  // Deploy LeadTrading contract
  const leadTrading = await deploy("LeadTrading", {
    from: deployer,
    args: [cUSDT.address],
    log: true,
    autoMine: true,
  });

  console.log("LeadTrading deployed to:", leadTrading.address);

  // Log deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("cUSDT:", cUSDT.address);
  console.log("LeadTrading:", leadTrading.address);
  console.log("========================\n");
};

export default deployLeadTrading;
deployLeadTrading.tags = ["LeadTrading", "all"];