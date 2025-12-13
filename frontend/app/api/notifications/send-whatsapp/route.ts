import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Send WhatsApp notification via Twilio
 * Sends call summary to agency owner and assigned agent
 */
export async function POST(req: NextRequest) {
  try {
    const { callLogId } = await req.json();

    if (!callLogId) {
      return NextResponse.json(
        { status: "error", message: "callLogId is required" },
        { status: 400 }
      );
    }

    // Validate Twilio credentials
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.error("❌ Twilio credentials not configured");
      return NextResponse.json(
        { status: "error", message: "WhatsApp service not configured" },
        { status: 500 }
      );
    }

    // Fetch call log with related data
    const { data: callLog, error: callError } = await supabaseAdmin
      .from("call_logs")
      .select(`
        id,
        agency_id,
        lead_id,
        agent_id,
        vapi_call_id,
        status,
        duration_seconds,
        recording_url,
        transcript,
        summary,
        language,
        metadata,
        created_at,
        updated_at,
        leads:lead_id (name, phone_number, address),
        agents:agent_id (name, phone_number, email)
      `)
      .eq("id", callLogId)
      .single();

    if (callError || !callLog) {
      console.error("❌ Error fetching call log:", callError);
      return NextResponse.json(
        { status: "error", message: "Call log not found" },
        { status: 404 }
      );
    }

    // Get agency owner phone number
    const { data: owner } = await supabaseAdmin
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", callLog.agency_id)
      .eq("role", "owner")
      .single();

    let ownerPhone: string | null = null;
    if (owner) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
      ownerPhone = user?.user?.user_metadata?.phone || null;
    }

    // Prepare message
    const callDate = new Date(callLog.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const duration = callLog.duration_seconds
      ? `${Math.floor(callLog.duration_seconds / 60)}:${(callLog.duration_seconds % 60).toString().padStart(2, "0")}`
      : "N/A";

    // Handle relationship queries - TypeScript infers arrays, but foreign keys return single objects
    const callLogData: any = callLog;
    const leadsData = callLogData?.leads;
    const agentsData = callLogData?.agents;
    
    const leadName = (Array.isArray(leadsData) ? leadsData[0]?.name : leadsData?.name) || "Unknown Lead";
    const agentName = (Array.isArray(agentsData) ? agentsData[0]?.name : agentsData?.name) || "Unassigned";
    const summary = callLog.summary || "No summary available.";

    // Build WhatsApp message
    const message = `📞 *Call Summary*

*Lead:* ${leadName}
*Agent:* ${agentName}
*Date:* ${callDate}
*Duration:* ${duration}
*Status:* ${callLog.status.toUpperCase()}

*Summary:*
${summary}

${callLog.recording_url ? `🎧 Recording: ${callLog.recording_url}` : ""}

View full details: ${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/calls`;

    // Send WhatsApp messages
    const sendPromises: Promise<any>[] = [];

    // Send to agency owner (if phone number available)
    if (ownerPhone) {
      sendPromises.push(
        sendWhatsAppMessage(
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsAppNumber,
          ownerPhone,
          message
        )
      );
    }

    // Send to assigned agent (if different from owner and has phone)
    const agentPhone = Array.isArray(agentsData) ? agentsData[0]?.phone_number : agentsData?.phone_number;
    if (agentPhone && agentPhone !== ownerPhone) {
      sendPromises.push(
        sendWhatsAppMessage(
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsAppNumber,
          agentPhone,
          message
        )
      );
    }

    // Send all messages
    const results = await Promise.allSettled(sendPromises);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📱 Sent ${sent} WhatsApp message(s), ${failed} failed`);

    return NextResponse.json({
      status: "ok",
      message: `Sent ${sent} WhatsApp notification(s)`,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error("❌ Error sending WhatsApp notification:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to send WhatsApp" },
      { status: 500 }
    );
  }
}

/**
 * Send WhatsApp message via Twilio API
 */
async function sendWhatsAppMessage(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  message: string
): Promise<any> {
  // Format phone number (ensure it starts with whatsapp:)
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const formattedFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const body = new URLSearchParams({
    From: formattedFrom,
    To: formattedTo,
    Body: message,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${error}`);
  }

  return await response.json();
}

