import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import TelegramBot from "node-telegram-bot-api";

const BOT_TOKEN = process.env.TG_BOT_TOKEN as string;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/prime/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Hello! How can I assist you?");
});
