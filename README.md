# AI Translator Bot - Telegram Bot with Stripe Billing

## 🌍 Features

- **100+ Languages**: Translate between any of 100+ supported languages
- **Auto-Detection**: Automatically detects source language
- **Tiered Plans**: Free, Pro ($9.99/mo), Enterprise ($99/mo)
- **Stripe Billing**: Secure payment processing via Stripe
- **History**: View your translation history
- **High Quality**: Powered by GPT-4 for premium translations

## 📦 Installation

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
npm start
```

## 🔑 Required Environment Variables

### Telegram
- `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/botfather)

### OpenAI
- `OPENAI_API_KEY`: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- `OPENAI_MODEL`: Model to use (default: `gpt-4`)

### Supabase
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### Stripe
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `STRIPE_PRO_PRICE_ID`: Stripe Pro plan price ID
- `STRIPE_ENTERPRISE_PRICE_ID`: Stripe Enterprise plan price ID

### App
- `APP_URL`: Your app URL (for Stripe redirects)
- `PORT`: Server port (default: 3000)

## 🗄️ Database Schema

Run these SQL commands in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  credits_remaining INTEGER DEFAULT 1000,
  total_translations INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translations table
CREATE TABLE translations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_translations_user_id ON translations(user_id);
CREATE INDEX idx_translations_created_at ON translations(created_at DESC);
```

## 💳 Stripe Setup

1. Create products and prices in Stripe Dashboard:
   - **Pro Plan**: $9.99/month, 10,000 credits
   - **Enterprise Plan**: $99/month, 100,000 credits

2. Setup webhook:
   - Endpoint: `https://your-app-url.com/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`

3. Copy price IDs to `.env`

## 🚀 Deployment

### Deploy to Vercel/Railway/Render

```bash
npm run build
# Deploy with your hosting provider
```

### Deploy with Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Pricing Tiers

| Tier | Price | Credits | Languages | Quality |
|------|-------|---------|-----------|---------|
| Free | $0 | 1,000/mo | 10 | Basic |
| Pro | $9.99/mo | 10,000/mo | 100+ | Premium |
| Enterprise | $99/mo | 100,000/mo | 100+ | Best |

## 🎯 Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/help` | Get help |
| `/lang` | List all languages |
| `/status` | Check account status |
| `/upgrade` | Upgrade plan |
| `/history` | View translations |

## 📝 Usage Example

```
User: Hello, how are you?

Bot: 🔮 Detected: English
     What language to translate to?

User: Spanish

Bot: ✅ Translation Complete
     
     Original (English):
     Hello, how are you?
     
     Translated (ES):
     Hola, ¿cómo estás?
     
     Tokens used: 24 | Credits remaining: 976
```

## 🤝 Support

For issues and questions, please open a GitHub issue.

## 📄 License

MIT
