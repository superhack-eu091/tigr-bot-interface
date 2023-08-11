import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import Safe, {
    EthersAdapter,
    SafeFactory,
    SafeAccountConfig,
    EthersAdapterConfig,
} from "@safe-global/protocol-kit";
import {
    SafeTransaction,
    SafeTransactionDataPartial,
} from "@safe-global/safe-core-sdk-types";
import { Message } from "node-telegram-bot-api";
import {
    SupportedNetworks,
    networkProvider,
    networkUrl,
} from "../config/network-config";
import { setEthAddress, getEthAddress, getEthBalance } from "./account-utils";
import { SafeInfo } from "../config/types/safe-types";

const initSigner = async (
    selectedNetwork: SupportedNetworks
): Promise<ethers.Wallet> => {
    // WALLET CONNECTOR WITH PROVIDER
    const wallet = new ethers.Wallet(`${process.env.PRIVATE_KEY_ACCOUNT_BOT}`);
    const provider = networkProvider(selectedNetwork);

    console.log(wallet);
    console.log(provider);

    return wallet.connect(provider as ethers.providers.Provider);
};

const initEthAdapter = async (
    selectedNetwork: SupportedNetworks
): Promise<EthersAdapter> => {
    // BUILD EthAdapter
    // by using ethers and initSigner function
    const botSigner = await initSigner(selectedNetwork);

    const accounts = await botSigner.getAddress();
    console.log("accounts: ", accounts);

    const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: botSigner,
    });

    return ethAdapter;
};

export const deploySafe = async (
    msg: Message,
    owners: string | string[],
    addressRecord: Record<number, string>,
    selectedNetwork: Record<number, SupportedNetworks>
): Promise<SafeInfo> => {
    // Init Safe SDK
    const demo__Network = SupportedNetworks.OPTIMISM_GOERLI;
    // initEthAdapter(selectedNetwork[msg.chat.id]);
    const ethAdapter = await initEthAdapter(demo__Network);
    console.log(ethAdapter);

    // Create Safe AA Factory
    const safeFactory = await SafeFactory.create({ ethAdapter });

    // Create Safe Account Config
    if (typeof owners === "string") owners = [owners];
    const threshold = 1;

    const safeAccountConfig: SafeAccountConfig = {
        owners,
        threshold,
        // ...
    };

    // Create Safe AA Wallet
    const safe: Safe = await safeFactory.deploySafe({ safeAccountConfig });

    // Get Safe AA Address
    const safeAddress = await getWalletAddress(safe);

    // Get Safe AA ChainId
    const safeChainId = await safe.getChainId();

    // Get Safe AA Balance
    const safeBalance = await getWalletBalance(safe);

    return {
        safe: safe,
        address: safeAddress,
        chainId: safeChainId,
        eoaOwner: owners[0],
        balance: safeBalance,
    };
};

export const setWalletAddress = (
    msg: Message,
    addressesRecord: Record<number, string>,
    address: string
) => {
    setEthAddress(msg, addressesRecord, address);
};

export const getWalletAddress = async (safe: Safe): Promise<string> => {
    return await safe.getAddress();
};

export const getWalletBalance = async (safe: Safe): Promise<BigNumber> => {
    return await safe.getBalance();
};
