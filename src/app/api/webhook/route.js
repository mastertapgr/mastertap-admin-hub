export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';
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
      .select('name, booking_config')
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
      uk: `✅ <b>Підключення успішне!</b>\n\nЛаскаво просимо <b>${client.name}</b>. Відτεπερ βи отримуватиμετε всі сповіщення про записи в цьому чаті.`,
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
    // Fetch appointment with client details
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*, clients(*)')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      await answerCallbackQuery(callbackId, "Error: Appointment not found.");
      return;
    }

    const client = appointment.clients;
    if (!client) {
      await answerCallbackQuery(callbackId, "Error: Client configuration missing.");
      return;
    }

    // Determine status and check if already processed
    if (appointment.status === 'confirmed' || appointment.status === 'cancelled') {
      await answerCallbackQuery(callbackId, "Already processed.");
      return;
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';

    // 1. Update Supabase
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId);
    
    if (updateError) throw updateError;

    // 2. Send 2nd Email (The "Same as we have" logic)
    if (appointment.customer_email) {
      try {
        // Use client-specific Resend API key if available, fallback to global
        const clientResendKey = client.booking_config?.resend_api_key || client.resend_api_key || process.env.RESEND_API_KEY;
        console.log("DEBUG: Resend Key Prefix:", clientResendKey ? clientResendKey.substring(0, 10) : "MISSING");
        const resend = new Resend(clientResendKey);
        
        const lang = appointment.lang || 'el';
        const emailDict = {
          el: { confirm: { subject: `Επιβεβαίωση Ραντεβού - ${client.name}`, title: "Το Ραντεβού Επιβεβαιώθηκε!", sub: "Είμαστε στην ευχάριστη θέση να σας ενημερώσουμε ότι το ραντεβού σας επιβεβαιώθηκε. Σας περιμένουμε!" }, cancel: { subject: `Ακύρωση Ραντεβού - ${client.name}`, title: "Το Ραντεβού Ακυρώθηκε", sub: "Λυπούμαστε, αλλά το ραντεβού σας έπρεπε να ακυρωθεί." }, labels: { hello: "Γεια σας", service: "Υπηρεσία", duration: "Διάρκεια", date: "Ημερομηνία", time: "Ώρα", footer: "Σας ευχαριστούμε!", powered: "Powered by MasterTap", callUs: "Για περισσότερες πληροφορίες καλέστε μας στο:", mins: "λεπτά" } },
          en: { confirm: { subject: `Appointment Confirmed - ${client.name}`, title: "Appointment Confirmed!", sub: "We are happy to inform you that your appointment has been confirmed. We look forward to seeing you!" }, cancel: { subject: `Appointment Cancelled - ${client.name}`, title: "Appointment Cancelled", sub: "We are sorry, but your appointment had to be cancelled." }, labels: { hello: "Hello", service: "Service", duration: "Duration", date: "Date", time: "Time", footer: "Thank you!", powered: "Powered by MasterTap", callUs: "For more information call us at:", mins: "min" } },
          uk: { confirm: { subject: `Запис підтверджено - ${client.name}`, title: "Запис підтверджено!", sub: "Ми раді повідомити вам, що ваш запис підтверджено. Чекаємо на вас!" }, cancel: { subject: `Запис скасовано - ${client.name}`, title: "Запис скасовано", sub: "На жаль, ваш запис довелося скасувати." }, labels: { hello: "Привіт", service: "Послуга", duration: "Тривалість", date: "Дата", time: "Час", footer: "Дяκємо!", powered: "Powered by MasterTap", callUs: "Для отримання додаткової інформації телефонуйте нам:", mins: "хв" } }
        };
        const L = emailDict[lang] || emailDict.el;
        const s = newStatus === 'confirmed' ? L.confirm : L.cancel;
        const lb = L.labels;
        const displayDate = appointment.appointment_date.split('-').reverse().join('-');
        const bizPhone = client.booking_config?.business_phone || client.phone || client.booking_config?.phone;
        const phoneSection = bizPhone ? `<div style="margin-top: 30px; text-align: center;"><p style="margin: 0; font-size: 14px; color: #666;">${lb.callUs} <a href="tel:${bizPhone}" style="color: #1a1a1a; text-decoration: none; font-weight: 700;">${bizPhone}</a></p></div>` : "";

        await resend.emails.send({
          from: 'MasterTap <onboarding@resend.dev>',
          to: appointment.customer_email.trim(),
          subject: s.subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 40px; color: #1a1a1a; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">${client.name || 'MasterTap'}</h1>
                <div style="width: 40px; height: 2px; background: #1a1a1a; margin: 20px auto;"></div>
                <h2 style="margin: 0; font-size: 18px; font-weight: 400; color: #666;">${s.title}</h2>
              </div>
              <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${lb.hello} <strong>${appointment.customer_name}</strong>,<br><br>${s.sub}</p>
              <div style="border-top: 1px solid #eee; border-bottom: 1px solid #eee; padding: 20px 0; margin: 30px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px; width: 120px;">${lb.service}</td><td style="padding: 8px 0; font-weight: 600;">${appointment.service_name}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">${lb.duration}</td><td style="padding: 8px 0; font-weight: 600;">${appointment.duration_minutes} ${lb.mins}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">${lb.date}</td><td style="padding: 8px 0; font-weight: 600;">${displayDate}</td></tr>
                  <tr><td style="padding: 8px 0; color: #666; font-size: 14px;">${lb.time}</td><td style="padding: 8px 0; font-weight: 600;">${appointment.appointment_time}</td></tr>
                </table>
              </div>
              ${phoneSection}
              <div style="text-align: center; margin-top: 40px;">
                <p style="font-size: 14px; color: #666;">${lb.footer}</p>
                <p style="font-size: 11px; color: #999; margin-top: 20px;">&copy; ${new Date().getFullYear()} ${client.name || 'MasterTap'}. All rights reserved.</p>
                <p style="margin-top: 10px;"><a href="https://mastertap.gr" style="font-size: 11px; color: #1a1a1a; text-decoration: none; font-weight: 600;">${lb.powered}</a></p>
              </div>
            </div>
          `
        });
      } catch (err) { console.error("❌ Email notify error:", err); }
    }

    // 3. Update Telegram Message (Using correct bot token)
    const clientToken = client.telegram_token || client.booking_config?.telegram_token || process.env.TELEGRAM_BOT_TOKEN;
    console.log("DEBUG: Telegram Token Prefix:", clientToken ? clientToken.substring(0, 10) : "MISSING");
    const nLang = client.notification_language || client.booking_config?.notification_language || 'el';
    const labels = {
      el: { confirmed: "ΕΠΙΒΕΒΑΙΩΘΗΚΕ", cancelled: "ΑΚΥΡΩΘΗΚΕ", success: "Επιτυχία", at: "στις" },
      en: { confirmed: "CONFIRMED", cancelled: "CANCELLED", success: "Success", at: "at" },
      uk: { confirmed: "ПІДТВЕРΔЖΕΝΟ", cancelled: "СΚΑΣΟΒΑΝΟ", success: "Уσпіχ", at: "о" }
    };
    const L_tg = labels[nLang] || labels.el;
    const timestamp = new Date().toLocaleString(nLang === 'uk' ? 'uk-UA' : (nLang === 'en' ? 'en-US' : 'el-GR'), { timeZone: 'Europe/Athens' });
    const statusText = newStatus === 'confirmed' ? L_tg.confirmed : L_tg.cancelled;
    const cleanText = originalText.split('\n\nΠαρακαλώ')[0].split('\n\nБудь λαска')[0].split('\n\nPlease')[0].trim();

    const editRes = await editMessage(chatId, messageId, `${newStatus === 'confirmed' ? '✅' : '❌'} <b>${statusText}</b> ${L_tg.at} ${timestamp}\n\n${cleanText}`, null, clientToken);
    console.log("DEBUG: Telegram Edit Result:", JSON.stringify(editRes));
    await answerCallbackQuery(callbackId, `${L_tg.success}: ${statusText}`, clientToken);

  } catch (error) {
    console.error("❌ handleAppointmentAction error:", error);
    await answerCallbackQuery(callbackId, "System Error. Please check Dashboard.");
  }
}
