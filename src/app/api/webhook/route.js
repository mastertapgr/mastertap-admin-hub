export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendMessage, editMessage, answerCallbackQuery } from '@/lib/telegram';

export async function POST(request) {
  try {
    const body = await request.json();

    // 1. Handle Commands (e.g. /start site-12)
    if (body.message && body.message.text) {
      const text = body.message.text;
      const chatId = body.message.chat.id;

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1) {
          const clientId = parts[1];
          await handleStartCommand(chatId, clientId);
          return NextResponse.json({ ok: true });
        } else {
          await sendMessage(chatId, "Welcome to MasterTap Bot! Please use the 'Connect' button from your Dashboard to link your account.");
          return NextResponse.json({ ok: true });
        }
      }
    }

    // 2. Handle Callback Queries (Confirm/Cancel buttons)
    if (body.callback_query) {
      const { data, message, id: callbackQueryId } = body.callback_query;
      const chatId = message.chat.id;
      const messageId = message.message_id;

      const [action, appointmentId] = data.split('_');
      await handleAppointmentAction(chatId, messageId, callbackQueryId, action, appointmentId, message.text);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleStartCommand(chatId, clientId) {
  try {
    // Find client in Supabase
    const { data: client, error } = await supabase
      .from('clients')
      .select('name, booking_config, notification_language')
      .eq('client_id', clientId)
      .single();

    if (error || !client) {
      await sendMessage(chatId, `❌ Error: Client ID <b>${clientId}</b> not found.`);
      return;
    }

    // Update client's telegram_chat_id in Supabase
    const { error: updateError } = await supabase
      .from('clients')
      .update({ telegram_chat_id: String(chatId) })
      .eq('client_id', clientId);

    if (updateError) throw updateError;

    const lang = client.notification_language || client.booking_config?.notification_language || 'el';
    const welcomeMessages = {
      el: `✅ <b>Σύνδεση Επιτυχής!</b>\n\nΚαλώς ήρθατε <b>${client.name}</b>. Από εδώ και πέρα θα λαμβάνετε όλες τις ειδοποιήσεις για τα ραντεβού σας σε αυτό το chat.`,
      uk: `✅ <b>Підключення успішне!</b>\n\nЛаскаво просиμο <b>${client.name}</b>. Відτεπερ βи отримуватиμετε всі сповіщення про записи в цьому чаті.`,
      en: `✅ <b>Connection Successful!</b>\n\nWelcome <b>${client.name}</b>. From now on, you will receive all appointment notifications in this chat.`
    };

    await sendMessage(chatId, welcomeMessages[lang] || welcomeMessages.el);

  } catch (error) {
    console.error("❌ handleStartCommand error:", error);
    await sendMessage(chatId, "❌ An error occurred during setup. Please try again later.");
  }
}

async function handleAppointmentAction(chatId, messageId, callbackId, action, appointmentId, originalText) {
  try {
    // Fetch appointment
    const { data: appointment } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
    if (!appointment) {
      await answerCallbackQuery(callbackId, "Error: Appointment not found.");
      return;
    }

    // Fetch client using client_id from appointment
    const { data: client } = await supabase.from('clients').select('*').eq('client_id', appointment.client_id).single();
    if (!client) {
      await answerCallbackQuery(callbackId, "Error: Client not found.");
      return;
    }

    const nLang = client.notification_language || client.booking_config?.notification_language || 'el';
    const labels = {
      el: { confirmed: "ΕΠΙΒΕΒΑΙΩΘΗΚΕ", cancelled: "ΑΚΥΡΩΘΗΚΕ", success: "Επιτυχία", at: "στις" },
      en: { confirmed: "CONFIRMED", cancelled: "CANCELLED", success: "Success", at: "at" },
      uk: { confirmed: "ПІДТВЕРΔЖΕΝΟ", cancelled: "СΚΑΣΟΒΑΝΟ", success: "Уσпіχ", at: "о" }
    };
    const L = labels[nLang] || labels.el;

    if (appointment.status === 'confirmed' || appointment.status === 'cancelled') {
      await answerCallbackQuery(callbackId, "Already processed.");
      return;
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
    await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId);

    const timestamp = new Date().toLocaleString(nLang === 'uk' ? 'uk-UA' : (nLang === 'en' ? 'en-US' : 'el-GR'), { timeZone: 'Europe/Athens' });
    const statusText = newStatus === 'confirmed' ? L.confirmed : L.cancelled;
    
    const cleanText = originalText.split('\n\nΠαρακαλώ')[0].split('\n\nБудь λαска')[0].split('\n\nPlease')[0].trim();
    
    await editMessage(chatId, messageId, `${newStatus === 'confirmed' ? '✅' : '❌'} <b>${statusText}</b> ${L.at} ${timestamp}\n\n${cleanText}`);
    await answerCallbackQuery(callbackId, `${L.success}: ${statusText}`);
    
  } catch (error) {
    console.error("❌ handleAppointmentAction error:", error);
    await answerCallbackQuery(callbackId, "System Error. Please check Dashboard.");
  }
}
