import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";

const networks: any = {
  hardhat: {
    chainId: 31337,
  },
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY",
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  },
};

// 🔀 Mainnet Forking — only enabled when MAINNET_RPC_URL is set in .env
// Usage: npx hardhat node --network hardhat-fork
if (process.env.MAINNET_RPC_URL) {
  networks["hardhat-fork"] = {
    chainId: 31337,
    forking: {
      url: process.env.MAINNET_RPC_URL,
      blockNumber: process.env.FORK_BLOCK ? parseInt(process.env.FORK_BLOCK) : undefined,
    },
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks,
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
