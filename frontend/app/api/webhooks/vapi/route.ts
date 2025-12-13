import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
 * Vapi Webhook Handler
 * Receives call data from Vapi (recordings, transcripts, summaries)
 * and stores them in the call_logs table.
 * 
 * Webhook events:
 * - call-status-update: Call status changed
 * - function-call: Function was called (e.g., bookAppointment)
 * - end-of-call-report: Call completed with full data
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify webhook signature (if Vapi provides one)
    const signature = req.headers.get("x-vapi-signature");
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const body = await req.text();
      const isValid = verifyVapiSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error("❌ Invalid Vapi webhook signature");
        return NextResponse.json(
          { status: "error", message: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // 2. Parse webhook payload
    const payload = await req.json();
    const eventType = payload.type || payload.event; // Vapi may use either
    
    console.log(`📞 Vapi Webhook: ${eventType}`, {
      callId: payload.call?.id || payload.callId,
      status: payload.call?.status || payload.status,
    });

    // 3. Handle different event types
    switch (eventType) {
      case "end-of-call-report":
      case "call-status-update":
        await handleCallUpdate(payload);
        break;
      
      case "function-call":
        await handleFunctionCall(payload);
        break;
      
      default:
        console.log(`⚠️ Unhandled Vapi event type: ${eventType}`);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Vapi webhook error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle call status updates and end-of-call reports
 */
async function handleCallUpdate(payload: any) {
  const call = payload.call || payload;
  const callId = call.id || call.callId;
  const status = call.status || "completed";
  
  // Extract metadata (we pass this when creating the call)
  const metadata = call.metadata || call.customData || {};
  const agencyId = metadata.agency_id || metadata.agencyId;
  const leadId = metadata.lead_id || metadata.leadId;
  const agentId = metadata.agent_id || metadata.agentId;

  if (!agencyId) {
    console.error("❌ Missing agency_id in call metadata");
    return;
  }

  // Extract call data
  const transcript = call.transcript || call.recording?.transcript || "";
  const summary = call.summary || call.recording?.summary || "";
  const recordingUrl = call.recording?.url || call.recordingUrl || "";
  const duration = call.duration || call.recording?.duration || 0;
  const language = call.language || metadata.language || "en";

  // Determine call status
  let callStatus: string = "completed";
  if (status === "no-answer" || status === "no_answer") {
    callStatus = "no_answer";
  } else if (status === "busy") {
    callStatus = "busy";
  } else if (status === "failed" || status === "error") {
    callStatus = "failed";
  } else if (status === "cancelled") {
    callStatus = "cancelled";
  }

  // Upsert call log
  const { data: callLog, error } = await supabaseAdmin
    .from("call_logs")
    .upsert(
      {
        vapi_call_id: callId,
        agency_id: agencyId,
        lead_id: leadId || null,
        agent_id: agentId || null,
        status: callStatus,
        duration_seconds: duration,
        recording_url: recordingUrl,
        transcript: transcript,
        summary: summary,
        language: language,
        metadata: {
          ...metadata,
          vapi_status: status,
          received_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "vapi_call_id",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    console.error("❌ Error saving call log:", error);
    return;
  }

  console.log(`✅ Call log saved: ${callLog.id}`);

  // If call was unanswered, create retry entry
  if (callStatus === "no_answer" && leadId) {
    await createCallRetry(callLog.id, leadId, agencyId);
  }

  // Send notifications (if call completed successfully)
  if (callStatus === "completed" && callLog) {
    await sendCallNotifications(callLog);
  }
}

/**
 * Handle function calls (e.g., bookAppointment)
 */
async function handleFunctionCall(payload: any) {
  const call = payload.call || payload;
  const functionName = payload.functionCall?.name || payload.function_name;
  const functionArgs = payload.functionCall?.parameters || payload.function_args || {};
  
  const metadata = call.metadata || call.customData || {};
  const agencyId = metadata.agency_id || metadata.agencyId;
  const leadId = metadata.lead_id || metadata.leadId;
  const agentId = metadata.agent_id || metadata.agentId;

  if (functionName === "bookAppointment" && agencyId && leadId && agentId) {
    // Extract appointment details
    const scheduledAt = functionArgs.time || functionArgs.scheduled_at;
    const notes = functionArgs.notes || "";

    if (scheduledAt) {
      await createAppointment({
        agencyId,
        leadId,
        agentId,
        scheduledAt,
        notes,
        callId: null, // Will be linked when call completes
      });
    }
  }
}

/**
 * Create a call retry entry for unanswered calls
 */
async function createCallRetry(callId: string, leadId: string, agencyId: string) {
  // Get retry configuration (default: retry after 2 hours, max 3 attempts)
  const retrySchedule = [2, 24]; // Hours
  const maxRetries = 3;

  // Check existing retries for this call
  const { data: existingRetries } = await supabaseAdmin
    .from("call_retries")
    .select("retry_count")
    .eq("call_id", callId)
    .order("retry_count", { ascending: false })
    .limit(1);

  const currentRetryCount = existingRetries?.[0]?.retry_count || 0;

  if (currentRetryCount >= maxRetries) {
    console.log(`⏭️ Max retries reached for call ${callId}`);
    return;
  }

  const nextRetryCount = currentRetryCount + 1;
  const hoursToWait = retrySchedule[nextRetryCount - 1] || 24;
  const scheduledAt = new Date();
  scheduledAt.setHours(scheduledAt.getHours() + hoursToWait);

  await supabaseAdmin.from("call_retries").insert({
    call_id: callId,
    lead_id: leadId,
    agency_id: agencyId,
    retry_count: nextRetryCount,
    scheduled_at: scheduledAt.toISOString(),
    status: "pending",
  });

  console.log(`📅 Retry scheduled: Call ${callId} will retry in ${hoursToWait} hours`);
}

/**
 * Create an appointment from a function call
 */
async function createAppointment(data: {
  agencyId: string;
  leadId: string;
  agentId: string;
  scheduledAt: string;
  notes: string;
  callId: string | null;
}) {
  const { error } = await supabaseAdmin.from("appointments").insert({
    agency_id: data.agencyId,
    lead_id: data.leadId,
    agent_id: data.agentId,
    call_id: data.callId,
    scheduled_at: data.scheduledAt,
    notes: data.notes,
    status: "scheduled",
  });

  if (error) {
    console.error("❌ Error creating appointment:", error);
  } else {
    console.log(`✅ Appointment created for lead ${data.leadId}`);
  }
}

/**
 * Send notifications to agency owner and assigned agent
 */
async function sendCallNotifications(callLog: any) {
  // This will be implemented in the notifications API
  // For now, just log
  console.log(`📧 Sending notifications for call ${callLog.id}`);
  
  // Trigger notification API (async, don't wait)
  fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/notifications/send-call-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callLogId: callLog.id }),
  }).catch((err) => console.error("Failed to send notifications:", err));
}

/**
 * Verify Vapi webhook signature (if provided)
 */
function verifyVapiSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  // Vapi may use HMAC-SHA256 or similar
  // Adjust based on Vapi's actual signature method
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = hmac.digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

