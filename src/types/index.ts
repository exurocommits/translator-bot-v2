// Translator Bot Types

export type User = {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  tier: 'free' | 'pro' | 'enterprise';
  credits_remaining: number;
  total_translations: number;
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing';
  created_at: string;
  updated_at: string;
};

export type Translation = {
  id: string;
  user_id: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  model: string;
  tokens_used: number;
  created_at: string;
};

export type SubscriptionTier = {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  credits_per_month: number;
  price: number;
  features: string[];
};

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    credits_per_month: 1000,
    price: 0,
    features: [
      '1000 translation credits/month',
      'Basic translation quality',
      '10 languages',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    credits_per_month: 10000,
    price: 9.99,
    features: [
      '10,000 translation credits/month',
      'Premium translation quality',
      'All 100+ languages',
      'Priority support',
      'No ads',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    credits_per_month: 100000,
    price: 99,
    features: [
      '100,000 translation credits/month',
      'Best-in-class translation quality',
      'All 100+ languages',
      'Dedicated support',
      'API access',
      'Custom branding',
    ],
  },
];

export type SupportedLanguage = {
  code: string;
  name: string;
  nativeName: string;
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
];
