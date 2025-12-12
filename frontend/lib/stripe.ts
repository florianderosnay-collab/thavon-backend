import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // FIX: Updated to the version the compiler demanded (2025-11-17.clover)
  apiVersion: "2025-11-17.clover", 
  typescript: true,
});

