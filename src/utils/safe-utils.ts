import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";
import { ContractReceipt } from "@ethersproject/contracts";
import Safe, {
    EthersAdapter,
    SafeFactory,
    SafeAccountConfig,
} from "@safe-global/protocol-kit";
import {
    SafeTransaction,
    SafeTransactionDataPartial,
} from "@safe-global/safe-core-sdk-types";
import { Message } from "node-telegram-bot-api";
import { SupportedNetworks, networkProvider } from "../config/network-config";
import { setEthAddress } from "./account-utils";
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
    const demo__Network = SupportedNetworks.ETHERUM_GOERLI;
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

export const createSafePaymentTx = async (
    safeAddress: string,
    to: string,
    amount: string
): Promise<SafeTransaction> => {
    return await createSafeTx(safeAddress, to, amount, "0x");
};

export const createSafeTx = async (
    safeAddress: string,
    to: string,
    amount: string,
    data: string
): Promise<SafeTransaction> => {
    // Init Safe SDK
    const demo__Network = SupportedNetworks.ETHERUM_GOERLI;
    // initEthAdapter(selectedNetwork[msg.chat.id]);
    const ethAdapter = await initEthAdapter(demo__Network);

    // Connect to Safe
    const safe = await Safe.create({ ethAdapter, safeAddress });

    // Create Transaction
    const amountWei = ethers.utils.parseEther(amount).toString(); // Convert to wei
    const safeTransactionData: SafeTransactionDataPartial = {
        to: to,
        value: amountWei,
        data: data,
    };

    const safeTransaction: SafeTransaction = await safe.createTransaction({
        safeTransactionData,
    });

    return safeTransaction;
};

export const signAndExecuteSafeTx = async (
    safe: Safe,
    safeTransaction: SafeTransaction
): Promise<ContractReceipt | undefined> => {
    // Sign Transaction
    const txHash = await safe.getTransactionHash(safeTransaction);
    const approveTxResponse = await safe.approveTransactionHash(txHash);
    await approveTxResponse.transactionResponse?.wait();
    console.log(`approvedTx: (${approveTxResponse})\n`);

    // Execute Transaction
    const executeTxResponse = await safe.executeTransaction(safeTransaction);
    const txReceipt = await executeTxResponse.transactionResponse?.wait();
    console.log(`executedTx: (${txReceipt?.transactionHash})\n`);

    return txReceipt;
};
