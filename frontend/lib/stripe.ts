import Stripe from "stripe";

// We now only export the 'Stripe' class, not an initialized client.
// This prevents the build process from crashing.
export { Stripe };

