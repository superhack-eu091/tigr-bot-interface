import fs from "fs";
import Safe from "@safe-global/protocol-kit";
import { Message, InlineKeyboardButton } from "node-telegram-bot-api";
import {
    telegram_bot as bot,
    sendTelegramMessage,
} from "../utils/telegram-bot";
import { base_commands, chain_commands } from "../config/bot-command-config";
import { ILoadConfig } from "../config/types/bot-types";
import {
    validateEthAddress,
    getEthBalance,
    getEthAddress,
    setEthAddress,
} from "../utils/account-utils";
import { setWalletAddress } from "../utils/safe-utils";
import {
    GREETING,
    INVALID_ETH_ADDRESS,
    PROMPT_NETWORK,
    UNDEFINED_NETWORK,
    INVALID_NETWORK,
    QUERY_FAILED,
} from "../config/prompt-config";
import {
    SupportedNetworks,
    addressExplorerUrl,
    formatDisplayNetwork,
    chainIdToSupportedNetwork,
} from "../config/network-config";
import {
    getNetwork,
    setNetwork,
    isSupportedNetwork,
} from "../utils/network-utils";
import { truncateAddress } from "../utils/address-utils";
import { deploySafe } from "../utils/safe-utils";
import { SafeInfo } from "../config/types/safe-types";

const userInputState: Record<number, string> = {};
let messageId: number | undefined = undefined;

export const runOnboarding = (
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    // Start the user journey.
    bot.onText(base_commands.START, (msg) => {
        loadUserConfigs(msg, userWalletAddress, activeNetwork);

        bot.sendMessage(msg.chat.id, GREETING, {
            reply_markup: {
                inline_keyboard: renderInlineKeyboard(
                    msg,
                    userWalletAddress,
                    activeNetwork
                ),
            },
        }).then((msg: Message) => {
            messageId = msg.message_id;
        });
    });

    // Get the active wallet address.
    bot.onText(chain_commands.GET_ACCOUNT, (msg: Message) => {
        getAccount(msg, userWalletAddress, activeNetwork, {
            strict: true,
            verbose: true,
        });
    });

    // Set the active wallet address.
    bot.onText(
        chain_commands.SET_ACCOUNT,
        (msg: Message, match: RegExpExecArray | null) =>
            setAccount(msg, userWalletAddress, activeNetwork, match)
    );

    // Get the active network.
    bot.onText(chain_commands.GET_NETWORK, (msg: Message) => {
        const network: string | null = getNetwork(msg, activeNetwork);

        if (network === null) {
            sendTelegramMessage(msg, UNDEFINED_NETWORK);
            return;
        }

        sendTelegramMessage(msg, PROMPT_NETWORK(network));
    });

    // Set the active network.
    bot.onText(chain_commands.SET_NETWORK, (msg: Message) => {
        // Verify the network was provided.
        if (msg.text === undefined) {
            sendTelegramMessage(msg, INVALID_NETWORK);
            return;
        }

        // Validate the network and save it.
        const supportedNetworkKey: string = msg.text
            .split(" ")[1]
            .toLowerCase();

        if (!isSupportedNetwork(supportedNetworkKey)) {
            sendTelegramMessage(msg, INVALID_NETWORK);
            return;
        }

        const network: string =
            SupportedNetworks[
                supportedNetworkKey.toUpperCase() as keyof typeof SupportedNetworks
            ];

        setNetwork(msg, activeNetwork, network);
        sendTelegramMessage(msg, `Your network has been saved!`);
    });

    // Get the active wallet balance.
    bot.onText(chain_commands.ACCOUNT_BALANCE, async (msg) => {
        const balance: string | null | undefined = await getEthBalance(
            msg,
            userWalletAddress
        );

        if (balance === undefined) {
            sendTelegramMessage(msg, "Something went wrong.");
        } else if (balance !== null) {
            sendTelegramMessage(msg, balance);
        }
    });

    // Handle callback queries.
    bot.on("callback_query", (query) => {
        if (query.message === undefined) {
            console.log(QUERY_FAILED);
            return;
        }

        const chatId = query.message.chat.id;

        if (query.data === "init_aa_wallet") {
            bot.sendMessage(chatId, "Please enter the wallet address:");
            userInputState[chatId] = "awaiting_eoa_address";
        }
    });

    // Handle user inputs.
    bot.on("message", (msg) => {
        const chatId = msg.chat.id;

        // Check if we're waiting for user's email address
        if (userInputState[chatId] === "awaiting_eoa_address") {
            const address = msg.text as string;

            // Create a new AA wallet for the user.
            updateAccount(msg, userWalletAddress, activeNetwork, address, {
                updateUserConfig: true,
            });
        }

        // Reset the state
        delete userInputState[chatId];
    });
};

const renderInlineKeyboard = (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
): InlineKeyboardButton[][] => {
    const account: string | null = getEthAddress(msg, userWalletAddress);

    return account !== null
        ? [
              ...loadUserConfigs(msg, userWalletAddress, activeNetwork),
              [{ text: "🔍  Explore NFTs  🔍", callback_data: "nft_profile" }],
              [
                  {
                      text: "🥜  Peanut Exchange",
                      callback_data: "peanut_exchange",
                  },
              ],
              [{ text: "🎫  Direct Buy", callback_data: "direct_nft_buy" }],
          ]
        : [
              [
                  {
                      text: "❗🏁  Create Wallet  🏁❗",
                      callback_data: "init_aa_wallet",
                  },
              ],
          ];
};

const getAccount = (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, string>,
    { strict, verbose }: { strict?: boolean; verbose?: boolean }
) => {
    const address: string | null = getEthAddress(msg, userWalletAddress, {
        strict: strict,
    });
    const network: string | null = getNetwork(msg, activeNetwork);

    if (address !== null) {
        const addressWithExplorerLink: string = addressExplorerUrl(
            network,
            address
        );
        const opts = { parse_mode: "HTML" };

        if (verbose) sendTelegramMessage(msg, addressWithExplorerLink, opts);
    }
};

const setAccount = (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>,
    match: RegExpExecArray | string | null,
    verbose: boolean = true
) => {
    match = parseMatchExpression(match);

    // Verify the Ethereum address was provided.
    if (match === null) {
        sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
        return;
    }

    // Validate the Ethereum address and save it.
    let address: string | null = match !== null ? match : null;

    if (validateEthAddress(address)) {
        setEthAddress(msg, userWalletAddress, address as string);
        bot.sendMessage(msg.chat.id, GREETING, {
            reply_markup: {
                inline_keyboard: renderInlineKeyboard(
                    msg,
                    userWalletAddress,
                    activeNetwork
                ),
            },
        });
    } else {
        if (verbose) sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
    }
};

const updateAccount = async (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>,
    match: RegExpExecArray | string | null,
    {
        verbose = true,
        updateUserConfig = false,
    }: { verbose?: boolean; updateUserConfig?: boolean } = {}
) => {
    match = parseMatchExpression(match);

    // Verify the Ethereum address was provided.
    if (match === null) {
        sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
        return;
    }

    // Validate the Ethereum address and save it.
    let address: string | null = match !== null ? match : null;

    console.log(activeNetwork);

    if (validateEthAddress(address)) {
        const safe: SafeInfo = await deploySafe(
            msg,
            [address] as Array<string>,
            userWalletAddress,
            activeNetwork
        );
        setWalletAddress(msg, userWalletAddress, safe.address);

        if (updateUserConfig)
            saveUserConfigs(safe.eoaOwner, safe.address, safe.chainId);

        bot.editMessageReplyMarkup(
            {
                inline_keyboard: renderInlineKeyboard(
                    msg,
                    userWalletAddress,
                    activeNetwork
                ),
            },
            {
                chat_id: msg.chat.id,
                message_id: messageId,
            }
        );
    } else {
        if (verbose) sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
    }
};

const parseMatchExpression = (match: RegExpExecArray | string | null) => {
    return match !== null
        ? typeof match === "string"
            ? match
            : match[1]
        : null;
};

const loadUserConfigs = (
    msg: Message,
    userWalletAddress: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
): InlineKeyboardButton[][] => {
    // Load and set configuration.
    const filePath = "./src/config/user-configs.json";

    // Read the configuration file.
    const user_configs: { [key: string]: ILoadConfig } =
        readUserConfigs(filePath);

    // Return the inline keyboard buttons for the user's accounts.
    const keyboardButtons: InlineKeyboardButton[][] = Object.keys(
        user_configs
    ).map((key, idx) => {
        if (idx === 0) {
            setEthAddress(
                msg,
                userWalletAddress,
                user_configs[key].walletAddress
            );
            setNetwork(msg, activeNetwork, user_configs[key].network);
        }

        return [
            {
                text: `💰 ${truncateAddress(user_configs[key].walletAddress)}`,
                callback_data: `set_active_account_${user_configs[key].walletAddress}`,
            },
            {
                text: `🌐 ${formatDisplayNetwork(
                    user_configs[key].network as SupportedNetworks
                )}`,
                callback_data: `set_active_network_${user_configs[key].network}`,
            },
        ];
    });

    return keyboardButtons;
};

function readUserConfigs(filePath: string): any {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
}

const saveUserConfigs = (
    eoaAddress: string,
    walletAddress: string,
    chainId: number
) => {
    const filePath = "./src/config/user-configs.json";
    const network: string = chainIdToSupportedNetwork(chainId);

    // Read the configuration file.
    const user_configs = readUserConfigs(filePath);

    const jsonString = JSON.stringify({
        ...{
            [`${eoaAddress}_${network}`]: {
                eoaAddress: eoaAddress,
                network: network,
                walletAddress: walletAddress,
            },
        },
        ...user_configs,
    });

    fs.writeFileSync(filePath, jsonString, "utf8");
};
