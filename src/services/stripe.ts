import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-02-01',
});

export const PRICES = {
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_placeholder',
};

export async function createCheckoutSession(
  customerId: string,
  tier: 'pro' | 'enterprise'
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: PRICES[tier],
        quantity: 1,
      },
    ],
    success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/cancelled`,
  });

  return session.url!;
}

export async function createCustomer(
  email: string,
  telegramUserId: number
): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    metadata: {
      telegram_user_id: telegramUserId.toString(),
    },
  });

  return customer.id;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.cancel(subscriptionId);
}

export async function handleWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Update user in database
      await updateUserSubscription(customerId, subscriptionId, 'active');
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await updateUserSubscription(customerId, subscription.id, 'canceled');
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.subscription as string;
      const customer = (await stripe.subscriptions.retrieve(subscription)).customer as string;

      await updateUserSubscription(customer, subscription, 'past_due');
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const subscription = invoice.subscription as string;
        const customer = (await stripe.subscriptions.retrieve(subscription)).customer as string;

        await updateUserSubscription(customer, subscription, 'active');
      }
      break;
    }
  }
}

async function updateUserSubscription(
  customerId: string,
  subscriptionId: string,
  status: string
): Promise<void> {
  // This would update the database - implement based on your schema
  // Import your database client here
  console.log(`Updating user ${customerId}: subscription ${subscriptionId} -> ${status}`);
}
