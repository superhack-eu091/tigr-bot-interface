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
    NFT_PURCHASE_INSTRUCTIONS,
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
import {
    SAFE_DELEGATED_ERC721_PROXY_ABI,
    ERC721_ABI,
} from "../utils/contract-utils";
import {
    getWalletOwners,
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
const MOCK_MARKET_ADDRESS = process.env.ADDRESS_MOCK_MARKET;
const MOCK_NFT_ADDRESSES = [
    // {
    //     tokenAddress: "0xc06Ce325fcCceAAeb809F00D1A9F7e844Bd8Ff09",
    //     tokenIds: ["648", "649"],
    // },
    // {
    //     tokenAddress: "0x38C7BC76019f3CAAD2c4139e28c0156DF48B1294",
    //     tokenIds: ["835", "836"],
    // },
    // {
    //     tokenAddress: "0xA12322ADDe12565FD25f23aB42140790d19d64bF",
    //     tokenIds: ["44", "45", "46", "47", "48", "49", "50", "51", "52", "53"],
    // },
    // {
    //     tokenAddress: "0x25c0b0dcc3dcaa32a203a02ae27735b5f8baf80b",
    //     tokenIds: ["53", "54", "55", "56", "57"],
    // },
    {
        /* Actual NFTs in Marketplace */
        tokenAddress: "0xd23A9aF27a59d71bDD89B612Ae62eb07DC99bB82",
        tokenIds: ["0", "1"],
    },
];
const CURRENT_PRICE_WEI = ethers.utils.parseEther("0.12345");

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

        console.log("query.data: ", query.data);

        if (query.data === "direct_nft_buy") {
            await initNftPurchase(
                query.message,
                userWalletAddress,
                activeNetwork
            );
            userInputState[chatId] = "awaiting_token_serial_number";
        } else if (query.data!.startsWith("purchase_nft_")) {
            const [, , tokenAddress, tokenId] = query.data!.split("_");

            await executePurchaseNft(
                query.message,
                userWalletAddress,
                activeNetwork,
                tokenAddress,
                tokenId,
                CURRENT_PRICE_WEI
            );
        }
    });

    bot.on("message", async (msg: Message) => {
        const chatId = msg.chat.id;

        if (userInputState[chatId] === "awaiting_token_serial_number") {
            const confirmation = await confirmPurchaseNft(
                msg,
                userWalletAddress,
                activeNetwork
            );
            if (confirmation === null) return;

            const { tokenAddress, tokenId } = confirmation;
        }

        // Reset state
        userInputState[chatId] = "";
    });
};

const initNftPurchase = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    await bot.sendMessage(msg.chat.id, NFT_PURCHASE_GREETING, {});

    await displayAvailableNfts(msg, userWalletAddress, activeNetwork);

    await bot.sendMessage(msg.chat.id, NFT_PURCHASE_INSTRUCTIONS, {});

    await bot.sendMessage(msg.chat.id, NFT_PURCHASE_EXAMPLE, {
        parse_mode: "HTML",
    });
};

const displayAvailableNfts = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    const table: string = await renderNftListing(
        msg,
        userWalletAddress,
        activeNetwork
    );

    await bot.sendMessage(msg.chat.id, table, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
};

const confirmPurchaseNft = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
): Promise<{ tokenAddress: string; tokenId: string } | null> => {
    const { tokenAddress, tokenId, isValidAddress, isValidTokenId } =
        parseNftPurchaseInput(msg.text!);

    if (!isValidAddress) {
        sendTelegramMessage(msg, INVALID_TOKEN_ADDRESS);
        return null;
    }
    if (!isValidTokenId) {
        sendTelegramMessage(msg, INVALID_TOKEN_ID);
        return null;
    }

    const nftPurchaseInputs: InlineKeyboardButton[][] =
        renderNftPurchaseOptions(tokenAddress, tokenId);

    await bot.sendMessage(msg.chat.id, "Proceed with purchase?", {
        reply_markup: {
            inline_keyboard: nftPurchaseInputs,
        },
    });

    return { tokenAddress, tokenId };
};

const executePurchaseNft = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>,
    tokenAddress: string,
    tokenId: string,
    currentPrice: ethers.BigNumber
) => {
    const walletAddress = userWalletAddress[msg.chat.id];
    const network = activeNetwork[msg.chat.id];
    const provider = networkProvider(network)!;
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY_ACCOUNT_BOT!,
        provider
    );

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

const getNftPayoff = async (
    network: SupportedNetworks,
    walletAddress: string,
    tokenAddress: string,
    tokenId: string
): Promise<ethers.BigNumber> => {
    const provider = networkProvider(network)!;

    const contract = new ethers.Contract(
        safeDelegatedProxyAddress(network)!,
        SAFE_DELEGATED_ERC721_PROXY_ABI,
        provider
    );

    const payoff: ethers.BigNumber =
        await contract.functions.getMaxAmountToPayForNFT(
            walletAddress,
            tokenAddress,
            tokenId
        );

    return payoff;
};

const renderNftListing = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
): Promise<string> => {
    const walletAddress = userWalletAddress[msg.chat.id];
    const network = activeNetwork[msg.chat.id];

    const headers = [
        "Contract Address",
        " Token ID  ",
        "   Seller   ",
        "   Price    ",
        "Expiration Time",
        "Created Time",
    ];

    const div =
        "|------------------+-------------+--------------+--------------+-----------------+--------------";

    const currentPrice = ethers.utils.formatEther(CURRENT_PRICE_WEI);

    const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
    };
    const expirationTime = new Date("31-Dec-2023").toLocaleDateString(
        "en-US",
        options
    );
    const createdTime = new Date("10-Aug-2023").toLocaleDateString(
        "en-US",
        options
    );

    const provider = networkProvider(network)!;

    let row: string = "";
    let link: string = "";
    const linsRecord: Record<string, string> = {};

    await Promise.all(
        MOCK_NFT_ADDRESSES.map(async ({ tokenAddress, tokenIds }) => {
            await Promise.all(
                tokenIds.map(async (tokenId) => {
                    const contract = new ethers.Contract(
                        tokenAddress,
                        ERC721_ABI,
                        provider
                    );

                    const tokenOwner = await contract.ownerOf(tokenId);
                    console.log(tokenOwner);

                    if (
                        ethers.utils.getAddress(tokenOwner) ==
                        ethers.utils.getAddress(MOCK_MARKET_ADDRESS!)
                    ) {
                        console.log(tokenOwner);

                        console.log(
                            await getNftPayoff(
                                network,
                                walletAddress,
                                tokenAddress,
                                tokenId
                            )
                        );

                        row +=
                            `| ${truncateAddress(tokenAddress)
                                .padStart(14, " ")
                                .padEnd(17, " ")}` +
                            `| ${tokenId.padEnd(12, " ")}` +
                            `| ${truncateAddress(walletAddress)} ` +
                            `| ${currentPrice.padEnd(12, "0")} ` +
                            `| ${expirationTime
                                .padStart(13, " ")
                                .padEnd(16, " ")}` +
                            `| ${createdTime} |\n`;

                        linsRecord[
                            tokenAddress
                        ] = `\n ${supportedNetworkToOpenseaAssetLink(
                            network,
                            tokenAddress,
                            tokenId
                        )}`;
                    }
                })
            );
        })
    );

    for (const tokenAddress in linsRecord) {
        link += linsRecord[tokenAddress];
    }

    const table = `<pre>| ${headers.join(
        " | "
    )} |\n${div}|\n${row}</pre>\n${link}`;

    console.log(table);

    return table;
};

const renderNftPurchaseOptions = (
    tokenAddress: string,
    tokenId: string
): InlineKeyboardButton[][] => {
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

const envChecks = (): boolean => {
    return !!MOCK_MARKET_ADDRESS;
};

if (!envChecks()) {
    console.error("Environment variables not set properly");
    process.exit(1);
}
