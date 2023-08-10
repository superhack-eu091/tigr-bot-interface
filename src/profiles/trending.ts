import { Message, CallbackQuery } from "node-telegram-bot-api";
import { telegram_bot as bot } from "../utils/telegram-bot";
import {
    supportedToZdkNetwork,
    SupportedNetworks,
} from "../config/network-config";
import { SupportedTrendingPeriods } from "../config/trending-config";
import { ZDK, ZDKChain, ZDKNetwork, SalesQueryArgs } from "@zoralabs/zdk";
import { NetworkInfo } from "@zoralabs/zdk/dist/queries/queries-sdk";

let messageId: number | undefined = undefined;

export const runTrending = (
    activeNetwork: Record<number, SupportedNetworks>,
    selectedTrendingPeriod: Record<number, SupportedTrendingPeriods>
) => {
    console.log("runTrending");

    bot.on("callback_query", (query: CallbackQuery) => {
        if (!query.message) {
            console.log("QUERY_FAILED");
            return;
        }

        if (query.data === "trending_profile") {
            console.log(activeNetwork[query.message.chat.id]);
            console.log(selectedTrendingPeriod[query.message.chat.id]);
            // initTrendingProfile(query.message);
        } else if (query.data!.startsWith("trending_network_select_")) {
            // updateTrendingProfileNetwork(query, activeNetwork);
        } else if (query.data!.startsWith("trending_trending_period_select_")) {
            // updateTrendingProfileTrendingPeriod(
            //     query,
            //     activeNetwork,
            //     selectedTrendingPeriod
            // );
        }
    });
};

const initTrendingProfile = (
    msg: Message,
    activeNetwork: Record<number, SupportedNetworks>,
    selectedTrendingPeriod: Record<number, SupportedTrendingPeriods>
) => {
    bot.sendMessage(msg.chat.id, "Select network and trending period:", {
        reply_markup: {
            inline_keyboard: renderTrendingInlineKeyboard(
                activeNetwork[msg.chat.id],
                selectedTrendingPeriod[msg.chat.id]
            ),
        },
    }).then((msg: Message) => {
        messageId = msg.message_id;
    });
};

const collectNftSales = async (
    activeNetwork: Record<number, SupportedNetworks>
) => {
    const [network, chain] = supportedToZdkNetwork(activeNetwork);

    const networkInfo: NetworkInfo = {
        network: network,
        chain: chain,
    };
};
