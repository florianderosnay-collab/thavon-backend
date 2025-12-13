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

// GET handler for testing/verification (returns helpful message)
export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      status: "ok",
      message: "Vapi webhook endpoint is active. This endpoint only accepts POST requests from Vapi.",
      endpoint: "/api/webhooks/vapi",
      method: "POST",
      note: "To test this endpoint, use a tool like Postman or curl with a POST request.",
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:POST:entry',
        message: 'Frontend webhook received request',
        data: { hasBody: !!req.body },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-receive',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
  } catch {}
  // #endregion

  try {
    // 1. Get request body (read once for both signature verification and parsing)
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    
    // 2. Verify webhook signature (if Vapi provides one)
    const signature = req.headers.get("x-vapi-signature");
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const isValid = verifyVapiSignature(bodyText, signature, webhookSecret);
      if (!isValid) {
        console.error("❌ Invalid Vapi webhook signature");
        return NextResponse.json(
          { status: "error", message: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    // 3. Determine event type (Vapi sends type in message.type for most events)
    // Priority: message.type > payload.type > payload.event
    const message = payload.message || {};
    const eventType = message.type || payload.type || payload.event;
    
    // #region agent log
    try {
      await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:POST:parsed',
          message: 'Event type identified',
          data: {
            eventType,
            hasCall: !!payload.call,
            callId: payload.call?.id || payload.callId,
            callStatus: payload.call?.status || payload.status,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'webhook-receive',
          hypothesisId: 'H2'
        })
      }).catch(() => {});
    } catch {}
    // #endregion
    
    console.log(`📞 Vapi Webhook: ${eventType}`, {
      callId: payload.call?.id || payload.callId || message.call?.id,
      status: payload.call?.status || payload.status || message.call?.status,
      hasMessage: !!message,
      hasPayloadCall: !!payload.call,
      hasMessageCall: !!message.call,
    });

    // 4. Handle different event types
    switch (eventType) {
      case "end-of-call-report":
      case "call-status-update":
        // #region agent log
        try {
          await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'route.ts:POST:handleCallUpdate',
              message: 'Calling handleCallUpdate',
              data: { eventType },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'webhook-receive',
              hypothesisId: 'H3'
            })
          }).catch(() => {});
        } catch {}
        // #endregion
        await handleCallUpdate(payload);
        break;
      
      case "function-call":
        await handleFunctionCall(payload);
        break;
      
      case "speech-update":
      case "conversation-update":
        // #region agent log
        try {
          await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'route.ts:POST:handleCallUpdate-speech',
              message: 'Handling speech/conversation update as call update',
              data: { eventType, hasCall: !!payload.call },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'webhook-receive',
              hypothesisId: 'H2'
            })
          }).catch(() => {});
        } catch {}
        // #endregion
        // Treat speech/conversation updates as call updates
        await handleCallUpdate(payload);
        break;
      
      default:
        // #region agent log
        try {
          await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'route.ts:POST:unhandled',
              message: 'Unhandled event type in frontend',
              data: { eventType },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'webhook-receive',
              hypothesisId: 'H2'
            })
          }).catch(() => {});
        } catch {}
        // #endregion
        console.log(`⚠️ Unhandled Vapi event type: ${eventType}`);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error: any) {
    // #region agent log
    try {
      await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:POST:error',
          message: 'Exception in webhook handler',
          data: {
            errorType: error?.constructor?.name,
            errorMessage: error?.message?.substring(0, 200),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'webhook-receive',
          hypothesisId: 'H3'
        })
      }).catch(() => {});
    } catch {}
    // #endregion
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
  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:handleCallUpdate:entry',
        message: 'Processing call update',
        data: {
          hasCall: !!payload.call,
          callId: payload.call?.id || payload.callId,
          callStatus: payload.call?.status || payload.status,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-process',
        hypothesisId: 'H3'
      })
    }).catch(() => {});
  } catch {}
  // #endregion

  // Vapi sends call data in message.call for Server URL events
  // For Webhook URL events, it's in payload.call or top-level
  const message = payload.message || {};
  const call = message.call || payload.call || payload;
  const callId = call.id || call.callId || message.callId || payload.id;
  const status = call.status || message.status || payload.status || "completed";
  
  // Extract metadata (we pass this when creating the call)
  // Check all possible locations
  const metadata = call.metadata || message.call?.metadata || call.customData || payload.metadata || payload.customData || {};
  let agencyId = metadata.agency_id || metadata.agencyId;
  let leadId = metadata.lead_id || metadata.leadId;
  let agentId = metadata.agent_id || metadata.agentId;

  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:handleCallUpdate:metadata',
        message: 'Extracted metadata',
        data: {
          agencyId: agencyId || 'MISSING',
          leadId: leadId || null,
          agentId: agentId || null,
          hasMetadata: !!metadata,
          callId: callId,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-process',
        hypothesisId: 'H3'
      })
    }).catch(() => {});
  } catch {}
  // #endregion

  // FALLBACK 1: If metadata is missing, try to look up existing call log by vapi_call_id
  if (!agencyId && callId) {
    try {
      const { data: existingCall } = await supabaseAdmin
        .from("call_logs")
        .select("agency_id, lead_id, agent_id")
        .eq("vapi_call_id", callId)
        .single();
      
      if (existingCall) {
        agencyId = existingCall.agency_id;
        leadId = leadId || existingCall.lead_id;
        agentId = agentId || existingCall.agent_id;
        
        // #region agent log
        try {
          await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'route.ts:handleCallUpdate:fallback-lookup-callid',
              message: 'Found agency_id via call_id lookup',
              data: {
                agencyId: agencyId,
                callId: callId,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'webhook-process',
              hypothesisId: 'H3'
            })
          }).catch(() => {});
        } catch {}
        // #endregion
      }
    } catch (lookupError) {
      // Ignore - try next fallback
    }
  }

  // FALLBACK 2: If still no agencyId, try to look up by phone number from the call
  if (!agencyId) {
    const phoneNumber = call.customer?.number || call.phoneNumber || payload.phoneNumber;
    if (phoneNumber) {
      try {
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("agency_id, id")
          .eq("phone_number", String(phoneNumber))
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        if (lead) {
          agencyId = lead.agency_id;
          leadId = leadId || lead.id;
          
          // #region agent log
          try {
            await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'route.ts:handleCallUpdate:fallback-lookup-phone',
                message: 'Found agency_id via phone number lookup',
                data: {
                  agencyId: agencyId,
                  phoneNumber: phoneNumber,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'webhook-process',
                hypothesisId: 'H3'
              })
            }).catch(() => {});
          } catch {}
          // #endregion
        }
      } catch (lookupError) {
        // Ignore - will fail below
      }
    }
  }

  if (!agencyId) {
    // #region agent log
    try {
      await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:handleCallUpdate:missing-agency',
          message: 'Missing agency_id - aborting',
          data: { 
            metadataKeys: Object.keys(metadata),
            callId: callId,
            payloadKeys: Object.keys(payload),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'webhook-process',
          hypothesisId: 'H3'
        })
      }).catch(() => {});
    } catch {}
    // #endregion
    console.error("❌ Missing agency_id in call metadata and could not lookup by call_id");
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
  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:handleCallUpdate:before-upsert',
        message: 'About to upsert call log',
        data: {
          callId,
          agencyId,
          leadId: leadId || null,
          callStatus,
          hasTranscript: !!transcript,
          hasRecording: !!recordingUrl,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-process',
        hypothesisId: 'H3'
      })
    }).catch(() => {});
  } catch {}
  // #endregion

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

  // #region agent log
  try {
    await fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:handleCallUpdate:after-upsert',
        message: 'Upsert result',
        data: {
          hasError: !!error,
          errorMessage: error?.message?.substring(0, 200) || null,
          hasCallLog: !!callLog,
          callLogId: callLog?.id || null,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-process',
        hypothesisId: 'H3'
      })
    }).catch(() => {});
  } catch {}
  // #endregion

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

  if (functionName === "bookAppointment" && agencyId && leadId) {
    // Extract appointment details
    const scheduledAt = functionArgs.time || functionArgs.scheduled_at;
    const notes = functionArgs.notes || "";

    if (scheduledAt) {
      // Assign agent if not provided
      let assignedAgentId = agentId;
      if (!assignedAgentId) {
        const { assignAgentToLead } = await import("@/lib/agent-assignment");
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, address, agency_id")
          .eq("id", leadId)
          .single();
        
        if (lead) {
          assignedAgentId = await assignAgentToLead(lead, scheduledAt);
        }
      }

      if (assignedAgentId) {
        await createAppointment({
          agencyId,
          leadId,
          agentId: assignedAgentId,
          scheduledAt,
          notes,
          callId: null, // Will be linked when call completes
        });

        // Create calendar event if agent has calendar sync
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        fetch(`${baseUrl}/api/calendar/create-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: assignedAgentId,
            lead_id: leadId,
            scheduled_at: scheduledAt,
            notes: notes,
            title: `Appointment with ${lead?.name || "Lead"}`,
          }),
        }).catch((err) => console.error("Failed to create calendar event:", err));
      }
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
  console.log(`📧 Sending notifications for call ${callLog.id}`);
  
  // Trigger notification API (async, don't wait)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  fetch(`${baseUrl}/api/notifications/send-call-summary`, {
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

