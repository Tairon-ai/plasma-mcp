const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const ethers = require("ethers");
const axios = require("axios");
const plasmaTools = require("./plasma-tools");

// Load environment variables
require('dotenv').config();
const { parseUnits, formatUnits } = ethers.utils;

// Plasma Network configuration
const PLASMA_CONFIG = {
  chainId: 9746, // Plasma Testnet
  rpcUrl: process.env.PLASMA_RPC_URL || "https://testnet-rpc.plasma.to",
  explorer: "https://testnet.plasmascan.to/",
  name: "Plasma Testnet",
  symbol: "XPL",
  decimals: 18,
  // DEX contracts will be deployed on mainnet
  router: "0x0000000000000000000000000000000000000000",
  factory: "0x0000000000000000000000000000000000000000",
  // Token addresses (to be deployed)
  tokens: {
    xpl: 'NATIVE',
    wxpl: '0x0000000000000000000000000000000000000000',
    usdt: '0x0000000000000000000000000000000000000000',
    usdc: '0x0000000000000000000000000000000000000000'
  }
};

// Wallet configuration
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;

// Initialize MCP server
const server = new McpServer(
  {
    name: "Plasma Testnet MCP",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Simple token map for resolving token names
const tokenMap = {
  xpl: 'NATIVE',
  native: 'NATIVE',
  wxpl: PLASMA_CONFIG.tokens.wxpl,
  weth: PLASMA_CONFIG.tokens.wxpl, // WXPL serves as WETH equivalent
  usdt: PLASMA_CONFIG.tokens.usdt,
  usdc: PLASMA_CONFIG.tokens.usdc
};

// ERC20 ABI for token interactions
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Get provider instance
function getProvider() {
  return new ethers.providers.JsonRpcProvider(PLASMA_CONFIG.rpcUrl, {
    chainId: PLASMA_CONFIG.chainId,
    name: PLASMA_CONFIG.name
  });
}

// Get wallet instance
function getWallet() {
  if (!WALLET_PRIVATE_KEY) {
    throw new Error("WALLET_PRIVATE_KEY environment variable is required for transactions");
  }
  const provider = getProvider();
  return new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
}

// Resolve token address from name
function resolveTokenAddress(token) {
  if (!token) return null;
  
  // Check if it's already an address
  if (token.startsWith('0x') && token.length === 42) {
    return token;
  }
  
  // Check token map
  const normalized = token.toLowerCase();
  return tokenMap[normalized] || null;
}

// Format token amount for display
function formatTokenAmount(amount, decimals = 18) {
  try {
    return formatUnits(amount, decimals);
  } catch (error) {
    return amount.toString();
  }
}

// Parse token amount from string
function parseTokenAmount(amount, decimals = 18) {
  try {
    return parseUnits(amount.toString(), decimals);
  } catch (error) {
    throw new Error(`Invalid amount format: ${amount}`);
  }
}

// ============= Zod Schemas for Tool Validation =============

const AccountBalanceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address").optional(),
});

const TransactionSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid recipient address"),
  value: z.string().optional(),
  data: z.string().optional(),
  gasLimit: z.string().optional(),
  gasPrice: z.string().optional(),
});

const SendXPLSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid recipient address"),
  amount: z.string().regex(/^\d+\.?\d*$/, "Invalid amount format"),
});

const TransactionStatusSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

const FaucetRequestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  faucetName: z.enum(["gasZip", "quickNode"]).optional(),
});

const TokenInfoSchema = z.object({
  tokenAddress: z.string(),
});

const GasEstimateSchema = z.object({
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid from address"),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid to address"),
  value: z.string().optional(),
  data: z.string().optional(),
});

const BlocksQuerySchema = z.object({
  count: z.number().min(1).max(20).optional().default(5),
});

// ============= Register Tools with McpServer =============

// Get service information
server.tool("getServiceInfo", "Get MCP service information and status", {}, async () => {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        name: "Plasma Network MCP",
        version: "2.0.0",
        network: PLASMA_CONFIG.name,
        chainId: PLASMA_CONFIG.chainId,
        rpcUrl: PLASMA_CONFIG.rpcUrl,
        explorer: PLASMA_CONFIG.explorer,
        features: [
          "Native XPL transfers",
          "Transaction monitoring",
          "Faucet integration",
          "Gas estimation",
          "Block explorer",
          "Token operations (pending deployment)",
          "DEX operations (pending deployment)"
        ],
        status: "operational"
      }, null, 2)
    }]
  };
});

// Get network information
server.tool("getNetworkInfo", "Get Plasma network information", {}, async () => {
  const provider = getProvider();
  const [blockNumber, network, gasPrice] = await Promise.all([
    provider.getBlockNumber(),
    provider.getNetwork(),
    provider.getGasPrice()
  ]);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        network: PLASMA_CONFIG.name,
        chainId: network.chainId,
        blockNumber,
        gasPrice: formatUnits(gasPrice, 'gwei') + ' gwei',
        rpcUrl: PLASMA_CONFIG.rpcUrl,
        explorer: PLASMA_CONFIG.explorer
      }, null, 2)
    }]
  };
});

// Get account balance
server.tool("getAccountBalance", "Get XPL balance for an address", AccountBalanceSchema, async (params) => {
  const provider = getProvider();
  
  // Use wallet address if no address provided
  const address = params.address || (WALLET_PRIVATE_KEY ? getWallet().address : null);
  if (!address) {
    throw new Error("No address provided and no wallet configured");
  }

  const balance = await provider.getBalance(address);
  const nonce = await provider.getTransactionCount(address);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        address,
        balance: formatUnits(balance, 18) + ' XPL',
        balanceWei: balance.toString(),
        nonce,
        explorer: `${PLASMA_CONFIG.explorer}/address/${address}`
      }, null, 2)
    }]
  };
});

// Send custom transaction
server.tool("sendTransaction", "Send a custom transaction", TransactionSchema, async (params) => {
  const wallet = getWallet();
  
  const tx = {
    to: params.to,
    value: params.value ? parseUnits(params.value, 18) : 0,
    data: params.data || '0x',
    gasLimit: params.gasLimit ? ethers.BigNumber.from(params.gasLimit) : undefined,
    gasPrice: params.gasPrice ? parseUnits(params.gasPrice, 'gwei') : undefined
  };

  // Estimate gas if not provided
  if (!tx.gasLimit) {
    tx.gasLimit = await wallet.estimateGas(tx);
  }

  // Get gas price if not provided
  if (!tx.gasPrice) {
    tx.gasPrice = await wallet.provider.getGasPrice();
  }

  const txResponse = await wallet.sendTransaction(tx);
  const receipt = await txResponse.wait();

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed',
        explorer: `${PLASMA_CONFIG.explorer}/tx/${receipt.transactionHash}`
      }, null, 2)
    }]
  };
});

// Send XPL
server.tool("sendXPL", "Send XPL to an address", SendXPLSchema, async (params) => {
  const wallet = getWallet();
  
  const amount = parseUnits(params.amount, 18);
  const tx = {
    to: params.to,
    value: amount
  };

  const txResponse = await wallet.sendTransaction(tx);
  const receipt = await txResponse.wait();

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        from: wallet.address,
        to: params.to,
        amount: params.amount + ' XPL',
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        explorer: `${PLASMA_CONFIG.explorer}/tx/${receipt.transactionHash}`
      }, null, 2)
    }]
  };
});

// Get transaction status
server.tool("getTransactionStatus", "Check transaction status by hash", TransactionStatusSchema, async (params) => {
  const provider = getProvider();
  
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(params.txHash),
    provider.getTransactionReceipt(params.txHash)
  ]);

  if (!tx) {
    throw new Error("Transaction not found");
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        txHash: params.txHash,
        status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
        blockNumber: receipt?.blockNumber || null,
        confirmations: receipt ? (await provider.getBlockNumber()) - receipt.blockNumber : 0,
        from: tx.from,
        to: tx.to,
        value: formatUnits(tx.value, 18) + ' XPL',
        gasPrice: formatUnits(tx.gasPrice || 0, 'gwei') + ' gwei',
        gasUsed: receipt?.gasUsed?.toString() || null,
        explorer: `${PLASMA_CONFIG.explorer}/tx/${params.txHash}`
      }, null, 2)
    }]
  };
});

// Request faucet
server.tool("requestFaucet", "Get testnet faucet information", FaucetRequestSchema, async (params) => {
  // For now, return info about faucets since we don't have live faucets yet
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        message: "Plasma testnet faucets",
        faucets: [
          {
            name: "Official Faucet",
            url: "https://faucet.plasma.to",
            amount: "100 XPL",
            frequency: "Once per day"
          },
          {
            name: "Discord Faucet",
            url: "https://discord.gg/plasma",
            amount: "50 XPL",
            frequency: "Once per 12 hours"
          }
        ],
        address: params.address,
        note: "Visit the faucet URLs to request testnet XPL tokens"
      }, null, 2)
    }]
  };
});

// Estimate gas
server.tool("estimateGas", "Estimate gas for a transaction", GasEstimateSchema, async (params) => {
  const provider = getProvider();
  
  const tx = {
    from: params.from,
    to: params.to,
    value: params.value ? parseUnits(params.value, 18) : 0,
    data: params.data || '0x'
  };

  const [gasLimit, gasPrice] = await Promise.all([
    provider.estimateGas(tx),
    provider.getGasPrice()
  ]);

  const gasCost = gasLimit.mul(gasPrice);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        gasLimit: gasLimit.toString(),
        gasPrice: formatUnits(gasPrice, 'gwei') + ' gwei',
        estimatedCost: formatUnits(gasCost, 18) + ' XPL',
        transaction: {
          from: params.from,
          to: params.to,
          value: params.value || '0'
        }
      }, null, 2)
    }]
  };
});

// Get latest blocks
server.tool("getLatestBlocks", "Get information about latest blocks", BlocksQuerySchema, async (params) => {
  const provider = getProvider();
  
  const latestBlock = await provider.getBlockNumber();
  const blocks = [];

  for (let i = 0; i < params.count; i++) {
    const blockNumber = latestBlock - i;
    const block = await provider.getBlock(blockNumber);
    
    blocks.push({
      number: block.number,
      hash: block.hash,
      timestamp: block.timestamp,
      miner: block.miner,
      transactions: block.transactions.length,
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString()
    });
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        latestBlock,
        blocks,
        explorer: PLASMA_CONFIG.explorer
      }, null, 2)
    }]
  };
});

// Get gas price
server.tool("getGasPrice", "Get current gas price", {}, async () => {
  const provider = getProvider();
  const gasPrice = await provider.getGasPrice();
  const block = await provider.getBlock('latest');
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        gasPrice: {
          wei: gasPrice.toString(),
          gwei: formatUnits(gasPrice, 'gwei'),
          eth: formatUnits(gasPrice, 'ether')
        },
        baseFee: block.baseFeePerGas ? formatUnits(block.baseFeePerGas, 'gwei') + ' gwei' : 'N/A',
        network: PLASMA_CONFIG.name,
        timestamp: new Date().toISOString()
      }, null, 2)
    }]
  };
});

// Get token info
server.tool("getTokenInfo", "Get token information (pending token deployment)", TokenInfoSchema, async (params) => {
  const tokenAddress = resolveTokenAddress(params.tokenAddress);
  
  if (!tokenAddress || tokenAddress === 'NATIVE') {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          symbol: 'XPL',
          name: 'Plasma',
          decimals: 18,
          type: 'native',
          address: 'NATIVE'
        }, null, 2)
      }]
    };
  }

  const provider = getProvider();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const [symbol, name, decimals, totalSupply] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals(),
      tokenContract.totalSupply()
    ]);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          address: tokenAddress,
          symbol,
          name,
          decimals,
          totalSupply: formatUnits(totalSupply, decimals),
          type: 'ERC20'
        }, null, 2)
      }]
    };
  } catch (error) {
    // Token contract not deployed or invalid
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Token not found or not yet deployed",
          address: tokenAddress,
          note: "This token address may not be deployed on Plasma testnet yet"
        }, null, 2)
      }]
    };
  }
});

// Start the server
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("🚀 Plasma Network MCP Server started");
  console.error(`📍 Network: ${PLASMA_CONFIG.name}`);
  console.error(`🔗 RPC: ${PLASMA_CONFIG.rpcUrl}`);
  console.error(`🔍 Explorer: ${PLASMA_CONFIG.explorer}`);
  console.error(`💼 Wallet configured: ${!!WALLET_PRIVATE_KEY}`);
  console.error("✅ Ready to process requests");
}

// Start the server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});