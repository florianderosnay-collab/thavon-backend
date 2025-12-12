import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// We need a SUPER ADMIN client to bypass RLS and update the agency
// Add this key to your .env.local as SUPABASE_SERVICE_ROLE_KEY
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("Stripe-Signature") as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
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
    }
  }

  return NextResponse.json({ received: true });
}

