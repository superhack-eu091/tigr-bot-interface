import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { ContractReceipt } from "@ethersproject/contracts";
import { InlineKeyboardButton, Message } from "node-telegram-bot-api";
import {
    telegram_bot as bot,
    sendTelegramMessage,
} from "../utils/telegram-bot";
import {
    NFT_PURCHASE_GREETING,
    NFT_PURCHASE_EXAMPLE,
    QUERY_FAILED,
} from "../config/prompt-config";
import {
    SupportedNetworks,
    networkProvider,
    safeDelegatedProxyAddress,
    supportedNetworkToOpenseaAssetLink,
} from "../config/network-config";
import { validateEthAddress } from "../utils/account-utils";
import { truncateAddress } from "../utils/address-utils";
import {
    INVALID_TOKEN_ADDRESS,
    INVALID_TOKEN_ID,
} from "../config/prompt-config";
import { SAFE_DELEGATED_ERC721_PROXY_ABI } from "../utils/contract-utils";
import {
    createSafeTx,
    createTxHash,
    approveTxHash,
    signAndExecuteSafeTx,
} from "../utils/safe-utils";
import { encodeSetAllowanceCalldata } from "../utils/proxy-utils";
import { OpenSeaSDK, Chain } from "opensea-js";
import { OrderV2 } from "opensea-js/lib/orders/types";
import { SafeTransaction } from "@safe-global/safe-core-sdk-types";

const userInputState: Record<number, string> = {};
let messageId: number | undefined = undefined;

export const runNftPurchase = async (
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    bot.on("callback_query", async (query) => {
        if (!query.message) {
            console.log(QUERY_FAILED);
            return;
        }

        const chatId = query.message.chat.id;

        if (query.data === "direct_nft_buy") {
            await initNftPurchase(
                query.message,
                userWalletAddress,
                activeNetwork
            );
            userInputState[chatId] = "awaiting_token_serial_number";
        }
    });
};

const initNftPurchase = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    await bot.sendMessage(msg.chat.id, NFT_PURCHASE_GREETING, {});

    await bot.sendMessage(msg.chat.id, NFT_PURCHASE_EXAMPLE, {
        parse_mode: "HTML",
    });

    bot.on("callback_query", async (query) => {
        if (!query.message) {
            console.log(QUERY_FAILED);
            return;
        }

        if (query.data!.startsWith("purchase_nft_")) {
            const [, , tokenAddress, tokenId] = query.data!.split("_");

            await approvePurchaseNft(
                query.message,
                userWalletAddress,
                activeNetwork,
                tokenAddress,
                tokenId,
                "1000000000000"
            );
        }
    });

    bot.on("message", async (msg: Message) => {
        const chatId = msg.chat.id;

        if (userInputState[chatId] === "awaiting_token_serial_number") {
            const { tokenAddress, tokenId, isValidAddress, isValidTokenId } =
                parseNftPurchaseInput(msg.text!);

            if (!isValidAddress)
                sendTelegramMessage(msg, INVALID_TOKEN_ADDRESS);
            if (!isValidTokenId) sendTelegramMessage(msg, INVALID_TOKEN_ID);

            await confirmPurchaseNft(
                msg,
                userWalletAddress,
                activeNetwork,
                tokenAddress,
                tokenId
            );
        }

        // Reset state
        userInputState[chatId] = "";
    });
};

const confirmPurchaseNft = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>,
    tokenAddress: string,
    tokenId: string
) => {
    const nftListing: OrderV2 = await getNftListing(
        msg,
        activeNetwork,
        tokenAddress,
        tokenId
    );

    const table: string = await renderNftListing(
        msg,
        activeNetwork,
        tokenAddress,
        tokenId,
        nftListing
    );

    await bot.sendMessage(msg.chat.id, table, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });

    const nftPurchaseInputs: InlineKeyboardButton[][] =
        renderNftPurchaseOptions(
            tokenAddress,
            tokenId,
            nftListing.currentPrice.toString()
        );

    await bot.sendMessage(msg.chat.id, "Proceed with purchase?", {
        reply_markup: {
            inline_keyboard: nftPurchaseInputs,
        },
    });
};

const approvePurchaseNft = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>,
    tokenAddress: string,
    tokenId: string,
    currentPrice: string
) => {
    const walletAddress = userWalletAddress[msg.chat.id];
    const network = activeNetwork[msg.chat.id];
    const provider = networkProvider(network)!;
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY_ACCOUNT_BOT!,
        provider
    );
    const openseaSDK = new OpenSeaSDK(
        provider,
        {
            chain: Chain.Goerli,
        },
        undefined,
        wallet
    );

    console.log(currentPrice);
    await convertEthToWeth(msg, activeNetwork, currentPrice);
    console.log(await wallet.getBalance());

    console.log(network);
    console.log(walletAddress);
    console.log(safeDelegatedProxyAddress(network));
    console.log(SAFE_DELEGATED_ERC721_PROXY_ABI);
    console.log(currentPrice);
    console.log(ethers.utils.formatEther(currentPrice));

    const fulfillmentData = await openseaSDK.createBuyOrder({
        asset: { tokenAddress: tokenAddress, tokenId: tokenId },
        accountAddress: process.env.ADDRESS_ACCOUNT_BOT!,
        startAmount: currentPrice,
        /* paymentTokenAddress: Default is WETH Address */
    });

    console.log(fulfillmentData);

    // const calldata = encodeSetAllowanceCalldata(
    //     tokenAddress,
    //     tokenId,
    //     currentPrice,
    //     walletAddress
    // );

    // console.log(calldata);

    // const safeTx: SafeTransaction = await createSafeTx(
    //     walletAddress,
    //     network,
    //     safeDelegatedProxyAddress(network)!,
    //     "0",
    //     calldata
    // );

    // console.log(safeTx);

    // let receipt: ContractReceipt | undefined = await approveTxHash(
    //     walletAddress,
    //     network,
    //     safeTx
    // );

    // console.log(receipt);

    // receipt = await signAndExecuteSafeTx(walletAddress, network, safeTx);

    // console.log(receipt);

    // const provider = networkProvider(network)!;
    // const contract = new ethers.Contract(
    //     safeDelegatedProxyAddress(network)!,
    //     SAFE_DELEGATED_ERC721_PROXY_ABI,
    //     provider
    // );
    // const allowanceKey = await contract.functions.generateAllowanceKey(
    //     userWalletAddress[msg.chat.id],
    //     "0xd774557b647330c91bf44cfeab205095f7e6c367",
    //     1,
    //     userWalletAddress[msg.chat.id]
    // );

    // console.log("allowanceKey: ", allowanceKey);
};

const getNftListing = async (
    msg: Message,
    activeNetwork: Record<number, SupportedNetworks>,
    tokenAddress: string,
    tokenId: string
): Promise<OrderV2> => {
    const network = activeNetwork[msg.chat.id];
    const provider = networkProvider(network)!;
    const openseaSDK = new OpenSeaSDK(provider, {
        chain: Chain.Goerli,
    });

    // Get sell orders for a specific NFT
    const { orders } = await openseaSDK.api.getOrders({
        assetContractAddress: tokenAddress,
        tokenId,
        side: "ask",
    });

    console.log("orders", orders);

    return orders[0];
};

const renderNftListing = async (
    msg: Message,
    activeNetwork: Record<number, SupportedNetworks>,
    tokenAddress: string,
    tokenId: string,
    nftListing: OrderV2
): Promise<string> => {
    const headers = [
        "Contract Address",
        " Token ID  ",
        "   Seller   ",
        "   Price    ",
        "Expiration Time",
        "Created Time",
    ];

    const div =
        "|------------------+-------------+---------------+-------------+-----------------+--------------";

    const currentPrice = ethers.utils.formatEther(nftListing.currentPrice!);

    const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
    };
    const expirationTime = new Date(nftListing.closingDate!).toLocaleDateString(
        "en-US",
        options
    );
    const createdTime = new Date(nftListing.createdDate!).toLocaleDateString(
        "en-US",
        options
    );

    const row =
        `| ${truncateAddress(tokenAddress)}     ` +
        `| ${tokenId.padEnd(12, " ")}` +
        `| ${truncateAddress(nftListing.maker.address)} ` +
        `| ${currentPrice.padEnd(12, "0")} ` +
        `| ${expirationTime}    ` +
        `| ${createdTime}`;

    const link = supportedNetworkToOpenseaAssetLink(
        activeNetwork[msg.chat.id],
        tokenAddress,
        tokenId
    );

    const table =
        `<pre>| ${headers.join(" | ")} |\n${div}|\n${row} |</pre>\n\n` +
        `🔗 ${link}`;

    console.log(table);

    return table;
};

const renderNftPurchaseOptions = (
    tokenAddress: string,
    tokenId: string,
    currentPrice: string
): InlineKeyboardButton[][] => {
    console.log(currentPrice);

    return [
        [
            {
                text: "Purchase",
                callback_data: `purchase_nft_${tokenAddress}_${tokenId}`,
            },
            { text: "Cancel", callback_data: "cancel_nft_purchase" },
        ],
    ];
};

const parseNftPurchaseInput = (
    input: string
): {
    tokenAddress: string;
    tokenId: string;
    isValidAddress: boolean;
    isValidTokenId: boolean;
} => {
    const [tokenAddress, tokenId] = input.split(",").map((x) => x.trim());

    return {
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        isValidAddress: validateEthAddress(tokenAddress),
        isValidTokenId: Number.isInteger(Number(tokenId)),
    };
};

const convertEthToWeth = async (
    msg: Message,
    activeNetwork: Record<number, SupportedNetworks>,
    amountInWei: string
) => {
    const network = activeNetwork[msg.chat.id];
    const provider = networkProvider(network)!;
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY_ACCOUNT_BOT!,
        provider
    );
    const WETH_CONTRACT_ADDRESS = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6";
    const weth = new ethers.Contract(
        WETH_CONTRACT_ADDRESS,
        WETH_ABI_WITHDRAW,
        wallet
    );

    const tx = await weth.withdraw(amountInWei);
    await tx.wait();

    console.log(tx);
    console.log("Withdrew", amountInWei, "ETH to WETH");
};

const WETH_ABI_DEPOSIT = [
    // Only the deposit function is added for simplicity
    {
        constant: false,
        inputs: [],
        name: "deposit",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
];

const WETH_ABI_WITHDRAW = [
    // Only the deposit function is added for simplicity
    {
        inputs: [
            {
                internalType: "uint256",
                name: "wad",
                type: "uint256",
            },
        ],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
];
