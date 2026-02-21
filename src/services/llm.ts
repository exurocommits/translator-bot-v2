import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<{ text: string; tokens: number }> {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a professional translator. Translate the given text from ${sourceLang} to ${targetLang}. Maintain the original meaning, tone, and style. Provide ONLY the translated text, no explanations.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const translatedText = response.choices[0]?.message?.content || text;
  const tokens = response.usage?.total_tokens || 0;

  return { text: translatedText, tokens };
}

export function detectLanguage(text: string): string {
  // Simple language detection (in production, use a proper detection library)
  const patterns: Record<string, RegExp> = {
    es: /[áéíóúñ¿¡]/i,
    fr: /[àâäéèêëïîôùûüÿç]/i,
    de: /[äöüß]/i,
    ru: /[а-яё]/i,
    ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
    ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
    zh: /[\u4E00-\u9FFF]/,
    ar: /[\u0600-\u06FF]/,
    hi: /[\u0900-\u097F]/,
    th: /[\u0E00-\u0E7F]/,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }

  return 'en'; // Default to English
}
