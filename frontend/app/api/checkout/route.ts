import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe"; // We will create this helper next
import { supabase } from "@/lib/supabaseClient"; // Reuse your existing client if it works server-side, or use admin client

export async function POST(req: Request) {
  try {
    const { agencyId, email } = await req.json();

    if (!agencyId || !email) {
      return NextResponse.json({ error: "Missing agencyId or email" }, { status: 400 });
    }

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID, // Created in Stripe Dashboard
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
      customer_email: email,
      // THE SECRET SAUCE: Attach the Agency ID to the metadata
      metadata: {
        agencyId: agencyId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

