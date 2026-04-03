import Stripe from 'stripe';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover' as const,
    })
  : null;

export const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || '';

export async function createCheckoutSession(userId: string, email: string): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: email,
    line_items: [
      {
        price: PREMIUM_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/dashboard/perfil?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/perfil?canceled=true`,
    metadata: { userId },
  });

  return session.url;
}

export async function createPortalSession(stripeCustomerId: string): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard/perfil`,
  });

  return session.url;
}
