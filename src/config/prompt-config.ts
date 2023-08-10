import { chain_command_references } from "./bot-command-config";

// Greeting Prompts
export const GREETING: string = `
NFTbot is the worlds first NFT sniper bot. Don’t miss a beat and mint the hottest NFTs on the market, all from inside Telegram. 

Navigate NFTs across various chains without having to worry about switching networks. No more clunky UX. Buying NFTs has never been easier. 

Click the button below to get started.
`;

// Account Prompts
export const INVALID_ETH_ADDRESS: string = `Invalid Ethereum address. Please send your Ethereum address after typing ${chain_command_references.SET_ACCOUNT}`;
export const INVALID_ETH_BALANCE: string = `Invalid Ethereum balance.`;

// Network Prompts
export const PROMPT_NETWORK = (network: string): string =>
    `Current network: ${network}`;
export const UNDEFINED_NETWORK = `The network is currently undefined. Please set your network after typing ${chain_command_references.SET_NETWORK}`;
export const INVALID_NETWORK = `Invalid network. Please set your network after typing ${chain_command_references.SET_NETWORK}`;

// Error Handling Prompts
export const QUERY_FAILED = "Something went wrong. Query message is undefined.";
