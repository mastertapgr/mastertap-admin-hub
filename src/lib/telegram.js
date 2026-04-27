const getBotToken = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing!");
  return token;
};

export async function sendMessage(chatId, text, replyMarkup = null, customToken = null) {
  try {
    const token = customToken || getBotToken();
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    console.error("❌ Telegram sendMessage error:", error);
    return null;
  }
}

export async function editMessage(chatId, messageId, text, replyMarkup = null, customToken = null) {
  try {
    const token = customToken || getBotToken();
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (error) {
    console.error("❌ Telegram editMessage error:", error);
    return null;
  }
}

export async function answerCallbackQuery(callbackQueryId, text, customToken = null) {
  try {
    const token = customToken || getBotToken();
    const payload = {
      callback_query_id: callbackQueryId,
      text: text
    };

    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("❌ Telegram answerCallbackQuery error:", error);
  }
}
