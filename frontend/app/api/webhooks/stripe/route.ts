import { NextResponse } from "next/server";
import { Stripe } from "@/lib/stripe"; // <-- Import the Stripe class
import { createClient } from "@supabase/supabase-js";

// We need a SUPER ADMIN client to bypass RLS and update the agency
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  // FIX 1: Initialize Stripe inside the function (at runtime)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-11-17.clover", // The version you fixed in the last step
    typescript: true,
  });

  const body = await req.text();
  
  // FIX 2: Access headers from the Request object directly
  const signature = req.headers.get("Stripe-Signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  // Handle the event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const agencyId = session.metadata?.agencyId;

    if (agencyId) {
      console.log(`💰 Payment received for Agency: ${agencyId}`);

      // Update Supabase
      const { error } = await supabaseAdmin
        .from("agencies")
        .update({ 
            subscription_status: "active",
            stripe_customer_id: session.customer
        })
        .eq("id", agencyId);

      if (error) {
        console.error("Supabase Update Error:", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
    } else {
        console.warn("⚠️ Payment received but no Agency ID found in metadata.");
    }
  }

  return NextResponse.json({ received: true });
}