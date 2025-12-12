import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin Client
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
 * This is required to update agency subscription status
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Stripe Webhook Handler
 * 
 * This endpoint receives webhook events from Stripe and processes them.
 * 
 * Security:
 * - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 * - Uses Supabase Admin Client to update database (bypasses RLS)
 * 
 * Events Handled:
 * - checkout.session.completed: Activates agency subscription
 */
export async function POST(req: Request) {
  // Validate required environment variables
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error: Webhook secret missing" },
      { status: 500 }
    );
  }

  // Validate Supabase configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Supabase configuration missing");
    return NextResponse.json(
      { error: "Server configuration error: Supabase credentials missing" },
      { status: 500 }
    );
  }

  try {
    // Initialize Stripe client using helper function
    const stripe = getStripeClient();

    // Get raw request body as text (required for signature verification)
    const body = await req.text();
    
    // Get Stripe signature from headers (Next.js 14+ API routes)
    const signature = req.headers.get("Stripe-Signature");

    // Validate signature header exists
    if (!signature) {
      console.error("❌ Missing Stripe-Signature header");
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature using Stripe's webhook secret
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      console.error(`❌ Webhook signature verification failed: ${error.message}`);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      
      // Extract agencyId from session metadata (set in /api/checkout)
      const agencyId = session.metadata?.agencyId;

      if (!agencyId) {
        console.warn("⚠️ Payment received but no Agency ID found in metadata.");
        // Return success to Stripe to avoid retries (but log the issue)
        return NextResponse.json({ 
          received: true,
          warning: "No agencyId in metadata" 
        });
      }

      console.log(`💰 Payment received for Agency: ${agencyId}`);

      // Update Supabase using Admin Client (bypasses RLS)
      const { data, error } = await supabaseAdmin
        .from("agencies")
        .update({ 
          subscription_status: "active",
          stripe_customer_id: session.customer || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", agencyId)
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase Update Error:", error);
        return NextResponse.json(
          { error: "Database update failed", details: error.message },
          { status: 500 }
        );
      }

      if (!data) {
        console.error(`❌ Agency ${agencyId} not found in database`);
        return NextResponse.json(
          { error: "Agency not found" },
          { status: 404 }
        );
      }

      console.log(`✅ Successfully activated subscription for Agency: ${agencyId}`);
    }

    // Return success for all other event types or after successful processing
    return NextResponse.json({ received: true });
    
  } catch (error: any) {
    // Handle Stripe client initialization errors
    if (error.message?.includes("STRIPE_SECRET_KEY")) {
      console.error("❌ Stripe client initialization failed:", error.message);
      return NextResponse.json(
        { error: "Server configuration error: Stripe secret key missing" },
        { status: 500 }
      );
    }

    // Handle any other unexpected errors
    console.error("❌ Unexpected error in webhook handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
