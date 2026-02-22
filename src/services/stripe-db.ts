import { supabase } from '../lib/supabase';

async function updateUserSubscription(
  customerId: string,
  subscriptionId: string,
  status: string
): Promise<void> {
  try {
    // Find user by stripe_customer_id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .single();

    if (profileError || !profile) {
      console.error(`User not found for customer ${customerId}`);
      return;
    }

    // Update subscription info
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_id: subscriptionId,
        subscription_status: status,
        // Add credits based on tier when subscribing
        ...(status === 'active' && {
          credits_remaining: supabase.raw('credits_remaining + ?'),
          tier: status === 'active' ? 'pro' : profile.tier,
        }),
      })
      .eq('id', profile.id);

    if (updateError) {
      console.error('Failed to update subscription:', updateError);
    }
  } catch (error) {
    console.error('updateUserSubscription error:', error);
  }
}

export { updateUserSubscription };
