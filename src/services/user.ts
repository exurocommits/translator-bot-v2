import { supabase } from '../lib/supabase';
import { type User, type Translation } from '../types';
import { translateText } from './llm';

export class UserService {
  async getOrCreateUser(telegramId: number, username?: string): Promise<User> {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (existingUser) {
      return existingUser;
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        username,
        tier: 'free',
        credits_remaining: 1000,
        total_translations: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create user');
    }

    return newUser;
  }

  async deductCredits(userId: string, amount: number): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        credits_remaining: supabase.raw('credits_remaining - ?'),
        total_translations: supabase.raw('total_translations + 1'),
      })
      .eq('id', userId)
      .gte('credits_remaining', amount);

    if (error) {
      throw new Error('Insufficient credits');
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return data;
  }

  async updateStripeInfo(
    userId: string,
    customerId: string,
    subscriptionId?: string,
    status?: string
  ): Promise<void> {
    await supabase
      .from('users')
      .update({
        stripe_customer_id: customerId,
        subscription_id: subscriptionId,
        subscription_status: status,
      })
      .eq('id', userId);
  }

  async addCredits(userId: string, amount: number): Promise<void> {
    await supabase
      .from('users')
      .update({
        credits_remaining: supabase.raw('credits_remaining + ?'),
      })
      .eq('id', userId);
  }

  async upgradeTier(userId: string, tier: 'pro' | 'enterprise'): Promise<void> {
    const tierCredits = tier === 'pro' ? 10000 : 100000;
    await supabase
      .from('users')
      .update({
        tier,
        credits_remaining: supabase.raw('credits_remaining + ?'),
      })
      .eq('id', userId);
  }
}

export class TranslationService {
  async translate(
    userId: string,
    sourceText: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ translatedText: string; tokensUsed: number }> {
    // Check user credits
    const user = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user.data || user.data.credits_remaining < 1) {
      throw new Error('Insufficient credits');
    }

    // Translate text
    const { text: translatedText, tokens } = await translateText(
      sourceText,
      sourceLang,
      targetLang
    );

    // Save translation
    await supabase.from('translations').insert({
      user_id: userId,
      source_text: sourceText,
      translated_text: translatedText,
      source_lang: sourceLang,
      target_lang: targetLang,
      model: 'gpt-4',
      tokens_used: tokens,
    });

    // Deduct credits (roughly 1 credit per 10 tokens)
    const creditsToDeduct = Math.ceil(tokens / 10);
    await new UserService().deductCredits(userId, creditsToDeduct);

    return { translatedText, tokensUsed: tokens };
  }

  async getHistory(userId: string, limit = 10): Promise<Translation[]> {
    const { data } = await supabase
      .from('translations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}
