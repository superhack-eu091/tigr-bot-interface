import fs from "fs";
import { Message, InlineKeyboardButton } from "node-telegram-bot-api";
import {
    telegram_bot as bot,
    sendTelegramMessage,
} from "../utils/telegram-bot";
import {
    base_commands,
    chain_commands,
    ILoadConfig,
} from "../config/bot-command-config";
import {
    validateEthAddress,
    getEthBalance,
    getEthAddress,
    setEthAddress,
} from "../utils/account-utils";
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
} from "../config/network-config";
import {
    getNetwork,
    setNetwork,
    isSupportedNetwork,
} from "../utils/network-utils";
import { truncateAddress } from "../utils/address-utils";

const userInputState: Record<number, string> = {};
let messageId: number | undefined = undefined;

export const runOnboarding = (
    userEthAddresses: Record<number, string>,
    activeNetwork: Record<number, SupportedNetworks>
) => {
    // Load account configuration file.
    bot.onText(
        base_commands.LOAD_CONFIG,
        (msg: Message, match: RegExpExecArray | null) => {
            if (match === null) {
                sendTelegramMessage(msg, "Error loading configuration file.");
                return;
            }

            // Load and set configuration.
            const filePath = "./src/config/user-configs.json";

            fs.readFile(filePath, "utf8", (err, data) => {
                if (err) {
                    console.log(err);
                    sendTelegramMessage(
                        msg,
                        "Error loading configuration file."
                    );
                    return;
                }

                const user_configs: { [key: string]: ILoadConfig } =
                    JSON.parse(data);

                // Get the configuration selected by the user.
                const config_selected: string = match[1];
                const config = user_configs[config_selected];

                // Set the Ethereum address.
                if (validateEthAddress(config.account)) {
                    setEthAddress(msg, userEthAddresses, config.account);
                    sendTelegramMessage(
                        msg,
                        "Your Ethereum address has been saved!"
                    );
                } else {
                    sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
                }

                // Set the network.
                setNetwork(msg, activeNetwork, config.network);
                sendTelegramMessage(msg, `Your network has been saved!`);
            });
        }
    );

    // Start the user journey.
    bot.onText(base_commands.START, (msg) => {
        bot.sendMessage(msg.chat.id, GREETING, {
            reply_markup: {
                inline_keyboard: renderInlineKeyboard(msg, userEthAddresses),
            },
        }).then((msg: Message) => {
            messageId = msg.message_id;
        });
    });

    // Get the active wallet address.
    bot.onText(chain_commands.GET_ACCOUNT, (msg: Message) => {
        getAccount(msg, userEthAddresses, activeNetwork, {
            strict: true,
            verbose: true,
        });
    });

    // Set the active wallet address.
    bot.onText(
        chain_commands.SET_ACCOUNT,
        (msg: Message, match: RegExpExecArray | null) =>
            setAccount(msg, userEthAddresses, match)
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
            userEthAddresses
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

        if (query.data === "add_account") {
            bot.sendMessage(chatId, "Please enter the wallet address:");
            userInputState[chatId] = "awaiting_address";
        } else if (query.data!.startsWith("set_active_account_")) {
            const query_data_bits: Array<string> = query.data!.split("_");
            updateAccount(
                query.message,
                userEthAddresses,
                query_data_bits[query_data_bits.length - 1]
            );
        }
    });

    // Handle user inputs.
    bot.on("message", (msg) => {
        const chatId = msg.chat.id;

        // Check if we're waiting for user's email address
        if (userInputState[chatId] === "awaiting_address") {
            const address = msg.text as string;

            // Validate the Ethereum address and save it.
            updateAccount(msg, userEthAddresses, address, {
                updateUserConfig: true,
            });

            // Reset the state
            delete userInputState[chatId];
        }
    });
};

const renderInlineKeyboard = (
    msg: Message,
    userEthAddresses: Record<number, string>
): InlineKeyboardButton[][] => {
    const account: string | null = getEthAddress(msg, userEthAddresses);

    return [
        [...loadUserConfigs(account)],
        [{ text: "🕸️  Set Network  🕸️", callback_data: "NONE" }],
        [{ text: "🔍  Explore NFTs  🔍", callback_data: "nft_profile" }],
        [{ text: `Add Wallet`, callback_data: "add_account" }],
    ];
};

const getAccount = (
    msg: Message,
    userEthAddresses: Record<number, string>,
    activeNetwork: Record<number, string>,
    { strict, verbose }: { strict?: boolean; verbose?: boolean }
) => {
    const address: string | null = getEthAddress(msg, userEthAddresses, {
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
    userEthAddresses: Record<number, string>,
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
        setEthAddress(msg, userEthAddresses, address as string);
        bot.sendMessage(msg.chat.id, GREETING, {
            reply_markup: {
                inline_keyboard: renderInlineKeyboard(msg, userEthAddresses),
            },
        });
    } else {
        if (verbose) sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
    }
};

const updateAccount = (
    msg: Message,
    userEthAddresses: Record<number, string>,
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

    if (validateEthAddress(address)) {
        setEthAddress(msg, userEthAddresses, address as string);
        bot.editMessageReplyMarkup(
            {
                inline_keyboard: renderInlineKeyboard(msg, userEthAddresses),
            },
            {
                chat_id: msg.chat.id,
                message_id: messageId,
            }
        );

        if (updateUserConfig) saveUserConfigs(address!);
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
    activeEthAddress: string | null
): InlineKeyboardButton[] => {
    // Load and set configuration.
    const filePath = "./src/config/user-configs.json";
    let activeAccountSetFlag: boolean = false;

    // Read the configuration file.
    const user_configs: { [key: string]: ILoadConfig } =
        readUserConfigs(filePath);

    // Return the inline keyboard buttons for the user's accounts.
    const keyboardButtons: InlineKeyboardButton[] = Object.keys(
        user_configs
    ).map((key) => {
        const isActiveEthAddress: boolean =
            activeEthAddress === user_configs[key].account;

        if (isActiveEthAddress) {
            activeEthAddress = null;
            activeAccountSetFlag = true;
        }

        return {
            text: isActiveEthAddress
                ? `💚  ${truncateAddress(user_configs[key].account)}`
                : truncateAddress(user_configs[key].account),
            callback_data: `set_active_account_${user_configs[key].account}`,
        };
    });

    // Conditionally add the active wallet address.
    if (activeEthAddress !== null) {
        return [
            {
                text: truncateAddress(activeEthAddress),
                callback_data: `set_active_account_${activeEthAddress}`,
            },
            ...keyboardButtons,
        ];
    } else {
        return keyboardButtons;
    }
};

function readUserConfigs(filePath: string): any {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
}

const saveUserConfigs = (address: string) => {
    const filePath = "./src/config/user-configs.json";

    // Read the configuration file.
    const user_configs = readUserConfigs(filePath);

    const jsonString = JSON.stringify({
        ...{
            [address]: {
                account: address,
                network: "",
            },
        },
        ...user_configs,
    });

    fs.writeFileSync(filePath, jsonString, "utf8");
};
