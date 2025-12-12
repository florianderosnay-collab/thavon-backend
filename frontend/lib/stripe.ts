import Stripe from "stripe";

/**
 * Initialize and return a Stripe client instance
 * Uses STRIPE_SECRET_KEY from environment variables
 * 
 * @returns Stripe client instance
 * @throws Error if STRIPE_SECRET_KEY is not configured
 */
export function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in environment variables");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-11-17.clover",
    typescript: true,
  });
}

// Also export the Stripe class for direct use if needed
export { Stripe };
