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

export const runOnboarding = (
    userEthAddresses: Record<number, string>,
    activeNetwork: Record<number, string>
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
        sendTelegramMessage(msg, GREETING);

        bot.sendMessage(msg.chat.id, "Choose an option:", {
            reply_markup: {
                inline_keyboard: renderInlineKeyboard(msg, userEthAddresses),
            },
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
        console.log(supportedNetworkKey);

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
            console.log("Something went wrong. Query message is undefined.");
            return;
        }

        const chatId = query.message.chat.id;

        if (query.data === "set_account") {
            bot.sendMessage(chatId, "Please enter the wallet address:");
            userInputState[chatId] = "awaiting_address";
        }
    });

    // Handle user inputs.
    bot.on("message", (msg) => {
        const chatId = msg.chat.id;

        // Check if we're waiting for user's email address
        if (userInputState[chatId] === "awaiting_address") {
            const address = msg.text as string;

            // Validate the Ethereum address and save it.
            sendTelegramMessage(msg, `Received wallet address: ${address}`);
            setAccount(msg, userEthAddresses, address);

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
        [
            { text: "OpenAI", url: "https://www.openai.com/" },
            { text: "Google", url: "https://www.google.com/" },
        ],
        account !== null
            ? [{ text: truncateAddress(account), callback_data: "NONE" }]
            : [],
        [{ text: "Set Wallet", callback_data: "set_account" }],
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
        verbose &&
            sendTelegramMessage(msg, "Your Ethereum address has been saved!");
    } else {
        verbose && sendTelegramMessage(msg, INVALID_ETH_ADDRESS);
    }
};

const parseMatchExpression = (match: RegExpExecArray | string | null) => {
    return match !== null
        ? typeof match === "string"
            ? match
            : match[1]
        : null;
};
