// Plasma Network Specific Tools
const { ethers } = require("ethers");
const axios = require("axios");

// Plasma Testnet Configuration
const PLASMA_TESTNET = {
  chainId: 9746,
  rpcUrl: "https://testnet-rpc.plasma.to",
  name: "Plasma Testnet",
  symbol: "XPL",
  decimals: 18,
  explorer: "https://testnet.plasmascan.to",
  faucets: {
    gasZip: {
      url: "https://gas.zip/faucet/plasma",
      api: "https://api.gas.zip/v1/faucet/plasma", // TODO: Verify API endpoint
      amount: "10",
      cooldown: 86400 // 24 hours in seconds
    },
    quickNode: {
      url: "https://faucet.quicknode.com/plasma/testnet",
      api: null, // No API endpoint available
      amount: "1",
      cooldown: 43200 // 12 hours in seconds
    }
  }
};

// Helper to get provider
function getProvider() {
  return new ethers.providers.JsonRpcProvider(PLASMA_TESTNET.rpcUrl, {
    chainId: PLASMA_TESTNET.chainId,
    name: 'plasma-testnet'
  });
}

// Request tokens from faucet (automated if possible)
async function requestFromFaucet(walletAddress, faucetName = 'gasZip') {
  try {
    const faucet = PLASMA_TESTNET.faucets[faucetName];

    if (!faucet) {
      throw new Error(`Unknown faucet: ${faucetName}`);
    }

    // If API endpoint exists, try automated request
    if (faucet.api) {
      try {
        const response = await axios.post(faucet.api, {
          address: walletAddress,
          network: 'plasma-testnet'
        }, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Plasma-MCP-Server/1.0'
          },
          timeout: 10000
        });

        if (response.data.success) {
          return {
            success: true,
            txHash: response.data.txHash,
            amount: faucet.amount,
            message: `Successfully requested ${faucet.amount} XPL from ${faucetName}`,
            nextRequestTime: Date.now() + (faucet.cooldown * 1000)
          };
        }
      } catch (apiError) {
        console.log(`API request failed, returning manual URL: ${apiError.message}`);
      }
    }

    // Return manual faucet URL if API fails or doesn't exist
    return {
      success: false,
      manual: true,
      url: faucet.url,
      amount: faucet.amount,
      message: `Please visit ${faucet.url} to manually request ${faucet.amount} XPL tokens`,
      instructions: [
        `1. Open the URL: ${faucet.url}`,
        `2. Connect your wallet`,
        `3. Enter address: ${walletAddress}`,
        `4. Complete any verification (captcha, etc.)`,
        `5. Click "Request Tokens"`,
        `6. Wait for transaction confirmation`
      ]
    };
  } catch (error) {
    throw new Error(`Faucet request failed: ${error.message}`);
  }
}

// Send XPL tokens
async function sendXPL(privateKey, toAddress, amount) {
  try {
    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);

    // Convert amount to Wei
    const amountWei = ethers.utils.parseEther(amount.toString());

    // Check balance
    const balance = await wallet.getBalance();
    if (balance.lt(amountWei)) {
      const balanceXPL = ethers.utils.formatEther(balance);
      throw new Error(`Insufficient balance. Have ${balanceXPL} XPL, need ${amount} XPL`);
    }

    // Estimate gas
    const gasPrice = await provider.getGasPrice();
    const gasLimit = 21000; // Standard transfer
    const gasCost = gasPrice.mul(gasLimit);

    // Check if balance covers amount + gas
    const totalNeeded = amountWei.add(gasCost);
    if (balance.lt(totalNeeded)) {
      const gasXPL = ethers.utils.formatEther(gasCost);
      throw new Error(`Insufficient balance for gas. Need ${gasXPL} XPL for gas`);
    }

    // Create transaction
    const tx = {
      to: toAddress,
      value: amountWei,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
      chainId: PLASMA_TESTNET.chainId
    };

    // Send transaction
    const txResponse = await wallet.sendTransaction(tx);

    // Wait for confirmation
    const receipt = await txResponse.wait();

    return {
      success: true,
      txHash: receipt.transactionHash,
      from: wallet.address,
      to: toAddress,
      amount: amount,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      explorer: `${PLASMA_TESTNET.explorer}/tx/${receipt.transactionHash}`
    };
  } catch (error) {
    throw new Error(`Failed to send XPL: ${error.message}`);
  }
}

// Check transaction status
async function checkTransaction(txHash) {
  try {
    const provider = getProvider();

    // Get transaction
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return {
        found: false,
        message: "Transaction not found"
      };
    }

    // Get receipt
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return {
        found: true,
        status: "pending",
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatEther(tx.value),
        nonce: tx.nonce,
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, "gwei") + " gwei"
      };
    }

    return {
      found: true,
      status: receipt.status === 1 ? "success" : "failed",
      from: tx.from,
      to: tx.to,
      value: ethers.utils.formatEther(tx.value),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorer: `${PLASMA_TESTNET.explorer}/tx/${txHash}`
    };
  } catch (error) {
    throw new Error(`Failed to check transaction: ${error.message}`);
  }
}

// Get account details
async function getAccountDetails(address) {
  try {
    const provider = getProvider();

    // Get balance
    const balance = await provider.getBalance(address);

    // Get transaction count (nonce)
    const txCount = await provider.getTransactionCount(address);

    // Get code (to check if contract)
    const code = await provider.getCode(address);
    const isContract = code !== "0x";

    return {
      address: address,
      balance: ethers.utils.formatEther(balance),
      balanceWei: balance.toString(),
      transactionCount: txCount,
      isContract: isContract,
      network: {
        name: PLASMA_TESTNET.name,
        chainId: PLASMA_TESTNET.chainId,
        symbol: PLASMA_TESTNET.symbol
      }
    };
  } catch (error) {
    throw new Error(`Failed to get account details: ${error.message}`);
  }
}

// Estimate gas for transaction
async function estimateGas(from, to, value, data = "0x") {
  try {
    const provider = getProvider();

    const tx = {
      from: from,
      to: to,
      value: ethers.utils.parseEther(value.toString()),
      data: data
    };

    // Estimate gas limit
    const gasLimit = await provider.estimateGas(tx);

    // Get current gas price
    const gasPrice = await provider.getGasPrice();

    // Calculate cost
    const gasCost = gasLimit.mul(gasPrice);

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.utils.formatUnits(gasPrice, "gwei") + " gwei",
      estimatedCost: ethers.utils.formatEther(gasCost) + " XPL",
      estimatedCostWei: gasCost.toString()
    };
  } catch (error) {
    throw new Error(`Failed to estimate gas: ${error.message}`);
  }
}

// Get latest blocks
async function getLatestBlocks(count = 5) {
  try {
    const provider = getProvider();
    const latestBlock = await provider.getBlockNumber();

    const blocks = [];
    for (let i = 0; i < count; i++) {
      const blockNumber = latestBlock - i;
      const block = await provider.getBlock(blockNumber);

      blocks.push({
        number: block.number,
        hash: block.hash,
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        transactions: block.transactions.length,
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString(),
        miner: block.miner
      });
    }

    return {
      latestBlock: latestBlock,
      blocks: blocks,
      network: PLASMA_TESTNET.name
    };
  } catch (error) {
    throw new Error(`Failed to get latest blocks: ${error.message}`);
  }
}

module.exports = {
  PLASMA_TESTNET,
  getProvider,
  requestFromFaucet,
  sendXPL,
  checkTransaction,
  getAccountDetails,
  estimateGas,
  getLatestBlocks
};
