import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We need a SUPER ADMIN client to bypass RLS and update the agency
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

// Vapi API endpoint
const VAPI_API_URL = "https://api.vapi.ai/call/phone";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agency_id: string }> }
) {
  try {
    const { agency_id: agencyId } = await params;

    if (!agencyId) {
      return NextResponse.json(
        { status: "error", message: "Agency ID is required" },
        { status: 400 }
      );
    }

    // 1. Parse incoming lead data
    let data: any;
    try {
      data = await req.json();
    } catch (error) {
      return NextResponse.json(
        { status: "error", message: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Map common field names (Zapier sends different keys sometimes)
    const name = data.name || data.first_name || data.Name || "New Lead";
    const phone = data.phone || data.phone_number || data.Phone;
    const address = data.address || data.Address || "your inquiry";

    if (!phone) {
      return NextResponse.json(
        { status: "ignored", reason: "No phone number provided" },
        { status: 400 }
      );
    }

    console.log(`🚀 INBOUND TRIGGER: Agency ${agencyId} -> Lead ${name} (${phone})`);

    // 2. Verify Subscription Status (Security Gate)
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("subscription_status")
      .eq("id", agencyId)
      .single();

    if (agencyError || !agency) {
      console.error("❌ Agency lookup failed:", agencyError);
      return NextResponse.json(
        { status: "error", message: "Agency not found" },
        { status: 404 }
      );
    }

    if (agency.subscription_status !== "active") {
      console.log("❌ Call blocked: Inactive subscription");
      return NextResponse.json(
        { status: "error", message: "Subscription inactive" },
        { status: 403 }
      );
    }

    // 3. Save Lead to Database
    const leadData = {
      agency_id: agencyId,
      name: name,
      phone_number: String(phone),
      address: address,
      status: "calling_inbound",
      asking_price: "0", // Not relevant for inbound usually
    };

    const { error: leadError } = await supabaseAdmin
      .from("leads")
      .insert(leadData);

    if (leadError) {
      console.error("❌ Failed to save lead:", leadError);
      // Continue anyway - don't block the call
    }

    // 4. Build Inbound Vapi Call Payload
    const inboundPrompt = `
# IDENTITY
You are the AI assistant for a top real estate agency. 
You are calling ${name} immediately because they just requested information about ${address} on our website.

# GOAL
Confirm they made the request and ask if they are looking to buy or sell. 
Your goal is to get a live agent on the line if they are serious.

# OPENER
"Hi ${name}, this is Thavon calling from the real estate team. I saw you just requested an estimate for ${address}. Do you have a minute?"
`;

    const callPayload = {
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || "YOUR_TWILIO_PHONE_ID_FROM_VAPI",
      customer: {
        number: String(phone),
        name: name,
      },
      assistant: {
        model: {
          provider: "openai",
          model: "gpt-4o",
          systemPrompt: inboundPrompt,
          functions: [
            {
              name: "bookAppointment",
              description: "Book the meeting.",
              parameters: {
                type: "object",
                properties: {
                  time: { type: "string" },
                  notes: { type: "string" },
                },
              },
            },
          ],
        },
        voice: {
          provider: "cartesia",
          voiceId: "248be419-c632-4f23-adf1-5324ed7dbf1d",
        },
        firstMessage: `Hi ${name}, this is the real estate team calling about your request. Do you have a minute?`,
      },
    };

    // 5. Trigger Vapi Call (Fire and forget - don't wait for response)
    const vapiApiKey = process.env.VAPI_API_KEY;
    if (!vapiApiKey) {
      console.error("❌ VAPI_API_KEY not configured");
      return NextResponse.json(
        { status: "error", message: "Vapi API key not configured" },
        { status: 500 }
      );
    }

    // Trigger call asynchronously (don't block the response)
    fetch(VAPI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callPayload),
    })
      .then((response) => {
        if (!response.ok) {
          console.error(`❌ Vapi API Error: ${response.status} ${response.statusText}`);
        } else {
          console.log(`✅ Vapi call initiated for ${name}`);
        }
      })
      .catch((error) => {
        console.error("❌ Vapi Call Failed:", error);
      });

    // Return immediately (don't wait for Vapi response)
    return NextResponse.json(
      { status: "calling", lead: name },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Inbound webhook error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

