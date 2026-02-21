import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import { UserService, TranslationService } from './services/user';
import { SUPPORTED_LANGUAGES, SUBSCRIPTION_TIERS } from './types';
import { detectLanguage } from './services/llm';
import { createCheckoutSession, createCustomer } from './services/stripe';
import { handleWebhook } from './services/stripe';
import Stripe from 'stripe';

const app = express();
app.use(express.json());

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

const userService = new UserService();
const translationService = new TranslationService();

// Pending translations state
const pendingTranslations = new Map<number, { targetLang: string; sourceText: string }>();

// Command: /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await userService.getOrCreateUser(msg.chat.id, msg.from?.username);

  const welcomeMessage = `
🌍 *Welcome to AI Translator Bot!*

*Your Status:*
• Tier: ${user.tier.toUpperCase()}
• Credits: ${user.credits_remaining.toLocaleString()}
• Total translations: ${user.total_translations}

*What I can do:*
📝 Translate text between 100+ languages
🔮 Auto-detect source language
💳 Upgrade to Pro/Enterprise for more credits

*Commands:*
/translate - Translate text
/history - View translation history
/upgrade - Upgrade your plan
/status - Check your account status
/help - Get help

Just send me any text to translate! I'll detect the language automatically.

*Languages:* ${SUPPORTED_LANGUAGES.slice(0, 10).map(l => l.name).join(', ')}... and 90+ more!

Ready? Send me some text! 🚀
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `
📚 *Help Guide*

*How to translate:*
1️⃣ Send me any text
2️⃣ I'll detect the language
3️⃣ I'll ask for target language
4️⃣ I'll send the translation

*Commands:*
/translate - Start a translation
/history - See past translations
/upgrade - Get more credits
/status - Check credits and plan
/lang - List all supported languages

*Example:*
1. Send: "Hello, how are you?"
2. I'll say: "Detected: English. What language to translate to?"
3. Reply: "Spanish"
4. I'll send: "Hola, ¿cómo estás?"

*Questions?*
Use /help anytime!

🚀 *Happy translating!*
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Command: /lang
bot.onText(/\/lang/, (msg) => {
  const chatId = msg.chat.id;

  const langList = SUPPORTED_LANGUAGES.map((l, i) => {
    return `${i + 1}. ${l.name} (${l.code}) - ${l.nativeName}`;
  }).join('\n');

  const message = `
🌍 *Supported Languages (${SUPPORTED_LANGUAGES.length})*

${langList}

*Language codes:*
Use the code when prompted:
en, es, fr, de, it, pt, ru, ja, ko, zh, ar, hi, tr, nl, pl, vi, th, id, ms, sv
  `;

  bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command: /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await userService.getOrCreateUser(msg.chat.id, msg.from?.username);

  const statusMessage = `
📊 *Your Account Status*

*Plan:* ${user.tier.toUpperCase()}
${user.tier === 'free' ? '💰 *Upgrade to Pro:* 10,000 credits/month' : ''}

*Credits:* ${user.credits_remaining.toLocaleString()}/${SUBSCRIPTION_TIERS.find(t => t.id === user.tier)?.credits_per_month.toLocaleString() || '∞'}

*Total Translations:* ${user.total_translations.toLocaleString()}

*Member Since:* ${new Date(user.created_at).toLocaleDateString()}

${user.stripe_customer_id ? '✅ Premium Member' : '🆓 Free Tier'}

*Last Updated:* ${new Date(user.updated_at).toLocaleString()}
  `;

  bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

// Command: /upgrade
bot.onText(/\/upgrade/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await userService.getOrCreateUser(msg.chat.id, msg.from?.username);

  if (user.tier !== 'free') {
    bot.sendMessage(chatId, `You're already on the ${user.tier.toUpperCase()} plan! 🎉`);
    return;
  }

  const upgradeMessage = `
💎 *Upgrade Your Plan*

*Free Tier:*
• 1,000 credits/month
• 10 languages
• Basic quality

*Pro - $9.99/month:*
• 10,000 credits/month (10x more!)
• 100+ languages
• Premium quality
• No ads
• Priority support

*Enterprise - $99/month:*
• 100,000 credits/month
• All languages
• Best quality
• API access
• Dedicated support

*Ready to upgrade?*
1. Click the button below
2. Complete payment via Stripe
3. Credits added instantly!
  `;

  // Send pricing buttons
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔥 Upgrade to Pro ($9.99/mo)', callback_data: 'upgrade_pro' },
      ],
      [
        { text: '🏢 Go Enterprise ($99/mo)', callback_data: 'upgrade_enterprise' },
      ],
    ],
  };

  bot.sendMessage(chatId, upgradeMessage, { parse_mode: 'Markdown', reply_markup: keyboard });
});

// Handle upgrade button clicks
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const data = query.data;

  if (data === 'upgrade_pro' || data === 'upgrade_enterprise') {
    const tier = data === 'upgrade_pro' ? 'pro' : 'enterprise';
    const user = await userService.getOrCreateUser(chatId, query.from?.username);

    try {
      if (!user.stripe_customer_id) {
        const customerId = await createUserCustomer(chatId, query.from);
        await userService.updateStripeInfo(user.id, customerId);
      }

      const checkoutUrl = await createCheckoutSession(
        user.stripe_customer_id!,
        tier
      );

      bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        `🔗 [Click here to complete your ${tier.toUpperCase()} upgrade](${checkoutUrl})`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (error) {
      bot.answerCallbackQuery(query.id, { text: 'Error creating checkout link' });
    }
  }
});

async function createUserCustomer(chatId: number, from: any): Promise<string> {
  const email = `${from.username || chatId}@telegram.bot`;
  return await createCustomer(email, chatId);
}

// Command: /history
bot.onText(/\/history/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await userService.getOrCreateUser(msg.chat.id, msg.from?.username);

  const history = await translationService.getHistory(user.id, 5);

  if (history.length === 0) {
    bot.sendMessage(chatId, "You haven't made any translations yet. Send me some text! 📝");
    return;
  }

  const historyText = history
    .map((t, i) => {
      return `${i + 1}. *${t.source_lang.toUpperCase()} → ${t.target_lang.toUpperCase()}*
Source: "${t.source_text.substring(0, 50)}${t.source_text.length > 50 ? '...' : ''}"
Translated: "${t.translated_text.substring(0, 50)}${t.translated_text.length > 50 ? '...' : ''}"
${new Date(t.created_at).toLocaleDateString()}`;
    })
    .join('\n\n');

  bot.sendMessage(chatId, `📜 *Recent Translations*\n\n${historyText}`, { parse_mode: 'Markdown' });
});

// Handle any text message - auto-translate flow
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const text = msg.text;

  // If there's a pending translation
  if (pendingTranslations.has(chatId)) {
    const pending = pendingTranslations.get(chatId)!;
    const targetLang = text.trim().toLowerCase();

    // Validate language code
    const validLang = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
    if (!validLang) {
      bot.sendMessage(chatId, `❌ Invalid language code. Use /lang to see all languages.\n\nTry again or send new text to start over.`);
      pendingTranslations.delete(chatId);
      return;
    }

    try {
      const user = await userService.getOrCreateUser(chatId, msg.from?.username);
      const { translatedText, tokensUsed } = await translationService.translate(
        user.id,
        pending.sourceText,
        detectLanguage(pending.sourceText),
        targetLang
      );

      bot.sendMessage(
        chatId,
        `✅ *Translation Complete*\n\n*Original (${pending.targetLang}):*\n${pending.sourceText}\n\n*Translated (${targetLang.toUpperCase()}):*\n${translatedText}\n\n📊 Tokens used: ${tokensUsed} | Credits remaining: ${user.credits_remaining}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }

    pendingTranslations.delete(chatId);
    return;
  }

  // New translation
  const detectedLang = detectLanguage(text);
  const langName = SUPPORTED_LANGUAGES.find(l => l.code === detectedLang)?.name || detectedLang;

  const keyboard = {
    inline_keyboard: SUPPORTED_LANGUAGES.slice(0, 10).map(l => [[{ text: l.name, callback_data: `trans_${l.code}` }]]),
  };

  bot.sendMessage(
    chatId,
    `🔮 *Detected: ${langName}*\n\n*Text:*\n${text}\n\n*What language to translate to?*`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );

  pendingTranslations.set(chatId, { targetLang: detectedLang, sourceText: text });
});

// Handle language selection from inline keyboard
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const data = query.data;

  if (data?.startsWith('trans_')) {
    const targetLang = data.replace('trans_', '');
    const pending = pendingTranslations.get(chatId);

    if (!pending) {
      bot.answerCallbackQuery(query.id, { text: 'Session expired. Send text again.' });
      return;
    }

    try {
      const user = await userService.getOrCreateUser(chatId, query.from?.username);
      const { translatedText, tokensUsed } = await translationService.translate(
        user.id,
        pending.sourceText,
        pending.targetLang,
        targetLang
      );

      bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        `✅ *Translation Complete*\n\n*Original (${pending.targetLang}):*\n${pending.sourceText}\n\n*Translated (${targetLang.toUpperCase()}):*\n${translatedText}\n\n📊 Tokens used: ${tokensUsed} | Credits remaining: ${user.credits_remaining}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error: any) {
      bot.answerCallbackQuery(query.id, { text: 'Error: ' + error.message });
      bot.sendMessage(chatId, `❌ ${error.message}`);
    }

    pendingTranslations.delete(chatId);
  }
});

// Stripe webhook endpoint
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  await handleWebhook(event);
  res.json({ received: true });
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Telegram bot running`);
});

console.log('🌍 AI Translator Bot started!');
