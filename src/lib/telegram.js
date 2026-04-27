const getBotToken = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing!");
  return token;
};

export async function sendMessage(chatId, text, replyMarkup = null) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${getBotToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (error) {
    console.error("❌ Telegram sendMessage error:", error);
    return null;
  }
}

export async function editMessage(chatId, messageId, text, replyMarkup = null) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${getBotToken()}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (error) {
    console.error("❌ Telegram editMessage error:", error);
    return null;
  }
}

export async function answerCallbackQuery(callbackQueryId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${getBotToken()}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (error) {
    console.error("❌ Telegram answerCallbackQuery error:", error);
  }
}
