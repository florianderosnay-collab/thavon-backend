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
    
    // Log raw payload structure for debugging
    console.log("🔍 RAW PAYLOAD:", {
      keys: Object.keys(payload),
      hasMessage: !!payload.message,
      messageKeys: payload.message ? Object.keys(payload.message) : [],
      payloadType: payload.type,
      payloadEvent: payload.event,
      messageType: payload.message?.type,
    });
    
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
    
    // Log extracted event info
    console.log(`📞 Vapi Webhook: ${eventType}`, {
      callId: payload.call?.id || payload.callId || message.call?.id,
      status: payload.call?.status || payload.status || message.call?.status,
      hasMessage: !!message,
      hasPayloadCall: !!payload.call,
      hasMessageCall: !!message.call,
      timestamp: new Date().toISOString(),
    });

    // 4. Handle different event types
    switch (eventType) {
      case "assistant-request":
        // Return dynamic assistant configuration
        return await handleAssistantRequest(payload);
      
      case "end-of-call-report":
      case "call-status-update":
      case "status-update":
        await handleCallUpdate(payload);
        break;
      
      case "function-call":
        await handleFunctionCall(payload);
        break;
      
      case "speech-update":
      case "conversation-update":
      case "assistant.started":
        // Treat these as call updates (create/update call log)
        await handleCallUpdate(payload);
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
 * Handle assistant-request events (if sent to frontend)
 * Note: These are typically handled by Railway Server URL
 */
async function handleAssistantRequest(payload: any): Promise<NextResponse> {
  // Just acknowledge - the real assistant-request handler is on Railway
  console.log("ℹ️ Assistant request received (forwarding to Railway is preferred)");
  return NextResponse.json({ status: "acknowledged" }, { status: 200 });
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
    console.error("❌ CRITICAL: Missing agency_id in call metadata", {
      callId,
      metadataKeys: Object.keys(metadata),
      payloadKeys: Object.keys(payload),
      messageKeys: message ? Object.keys(message) : [],
      hasCall: !!call,
      phoneNumber: call.customer?.number || call.phoneNumber || payload.phoneNumber,
    });
    return;
  }

  // Extract call data
  // For end-of-call-report, data is in message.* not call.recording.*
  const transcript = message.transcript || call.transcript || call.recording?.transcript || "";
  const summary = message.summary || call.summary || call.recording?.summary || "";
  const recordingUrl = message.recordingUrl || message.stereoRecordingUrl || call.recording?.url || call.recordingUrl || "";
  // Convert duration to integer (database column is INTEGER, Vapi sends decimal)
  const durationRaw = message.durationSeconds || call.duration || call.recording?.duration || 0;
  const duration = Math.round(Number(durationRaw)) || 0;
  const language = call.language || metadata.language || "en";

  // Determine call status
  // Normalize status to lowercase for comparison
  const normalizedStatus = (status || "").toLowerCase().trim();
  
  let callStatus: string = "completed";
  if (normalizedStatus === "no-answer" || normalizedStatus === "no_answer" || normalizedStatus === "noanswer") {
    callStatus = "no_answer";
  } else if (normalizedStatus === "busy") {
    callStatus = "busy";
  } else if (normalizedStatus === "failed" || normalizedStatus === "error") {
    callStatus = "failed";
  } else if (normalizedStatus === "cancelled" || normalizedStatus === "canceled" || normalizedStatus === "cancel") {
    callStatus = "cancelled";
  } else if (normalizedStatus === "ended" || normalizedStatus === "completed") {
    callStatus = "completed";
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'route.ts:handleCallUpdate:status-mapping',
      message: 'Status mapping result',
      data: {
        rawStatus: status,
        normalizedStatus: normalizedStatus,
        mappedStatus: callStatus,
        callId: callId,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'webhook-process',
      hypothesisId: 'H4'
    })
  }).catch(() => {});
  // #endregion

  console.log("✅ Processing call update", {
    callId,
    agencyId,
    leadId,
    rawStatus: status,
    mappedStatus: callStatus,
    hasRecording: !!recordingUrl,
    hasTranscript: !!transcript,
  });

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
    console.error("❌ CRITICAL: Error saving call log to database", {
      error: error.message,
      code: error.code,
      details: error.details,
      callId,
      agencyId,
    });
    return;
  }
  
  console.log("✅ Call log saved successfully", {
    callLogId: callLog?.id,
    callId,
    agencyId,
    hasRecording: !!recordingUrl,
    hasTranscript: !!transcript,
    recordingUrl: recordingUrl || "NONE",
    transcriptLength: transcript?.length || 0,
    duration,
  });

  console.log(`✅ Call log saved: ${callLog.id}`);

  // Update lead status based on call outcome
  if (leadId) {
    let leadStatus: string | null = null;
    
    if (callStatus === "completed") {
      leadStatus = "called";
    } else if (callStatus === "no_answer") {
      leadStatus = "no_answer";
    } else if (callStatus === "busy") {
      leadStatus = "callback"; // Mark for callback
    } else if (callStatus === "cancelled") {
      // Don't update status for cancelled calls
      leadStatus = null;
    } else if (callStatus === "failed") {
      // Don't update status for failed calls, keep as is
      leadStatus = null;
    }

    if (leadStatus) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:handleCallUpdate:update-lead-status',
          message: 'Updating lead status',
          data: {
            leadId: leadId,
            callStatus: callStatus,
            newLeadStatus: leadStatus,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'webhook-process',
          hypothesisId: 'H6'
        })
      }).catch(() => {});
      // #endregion

      const { error: leadUpdateError } = await supabaseAdmin
        .from("leads")
        .update({ 
          status: leadStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (leadUpdateError) {
        console.error("❌ Error updating lead status:", leadUpdateError);
      } else {
        console.log(`✅ Lead ${leadId} status updated to: ${leadStatus}`);
      }
    }
  }

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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'route.ts:handleFunctionCall:entry',
      message: 'Function call received',
      data: {
        payloadKeys: Object.keys(payload),
        hasFunctionCall: !!payload.functionCall,
        functionName: payload.functionCall?.name || payload.function_name,
        hasCall: !!payload.call,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'webhook-process',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  const call = payload.call || payload;
  const functionName = payload.functionCall?.name || payload.function_name;
  const functionArgs = payload.functionCall?.parameters || payload.function_args || {};
  
  const metadata = call.metadata || call.customData || {};
  const agencyId = metadata.agency_id || metadata.agencyId;
  const leadId = metadata.lead_id || metadata.leadId;
  const agentId = metadata.agent_id || metadata.agentId;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'route.ts:handleFunctionCall:extracted',
      message: 'Extracted function call data',
      data: {
        functionName: functionName,
        functionArgs: functionArgs,
        agencyId: agencyId,
        leadId: leadId,
        agentId: agentId,
        hasScheduledAt: !!(functionArgs.time || functionArgs.scheduled_at),
        scheduledAt: functionArgs.time || functionArgs.scheduled_at,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'webhook-process',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  if (functionName === "bookAppointment" && agencyId && leadId) {
    // Extract appointment details
    const scheduledAt = functionArgs.time || functionArgs.scheduled_at;
    const notes = functionArgs.notes || "";

    if (scheduledAt) {
      // Assign agent if not provided
      let assignedAgentId = agentId;
      let leadName = "Lead"; // Default lead name
      
      if (!assignedAgentId) {
        const { assignAgentToLead } = await import("@/lib/agent-assignment");
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, name, address, agency_id")
          .eq("id", leadId)
          .single();
        
        if (lead) {
          assignedAgentId = await assignAgentToLead(lead, scheduledAt);
          leadName = lead.name || "Lead";
        }
      } else {
        // Fetch lead name if we already have an assigned agent
        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("name")
          .eq("id", leadId)
          .single();
        if (lead) {
          leadName = lead.name || "Lead";
        }
      }

      if (assignedAgentId) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'route.ts:handleFunctionCall:before-create',
            message: 'About to create appointment',
            data: {
              agencyId: agencyId,
              leadId: leadId,
              agentId: assignedAgentId,
              scheduledAt: scheduledAt,
              notes: notes,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'webhook-process',
            hypothesisId: 'H5'
          })
        }).catch(() => {});
        // #endregion

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
            title: `Appointment with ${leadName}`,
          }),
        }).catch((err) => console.error("Failed to create calendar event:", err));
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'route.ts:handleFunctionCall:no-agent',
            message: 'No agent assigned, cannot create appointment',
            data: {
              agencyId: agencyId,
              leadId: leadId,
              agentId: agentId,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'webhook-process',
            hypothesisId: 'H5'
          })
        }).catch(() => {});
        // #endregion
        console.error("❌ Cannot create appointment: No agent assigned");
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'route.ts:handleFunctionCall:no-scheduledAt',
          message: 'No scheduledAt time provided',
          data: {
            functionArgs: functionArgs,
            scheduledAt: functionArgs.time || functionArgs.scheduled_at,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'webhook-process',
          hypothesisId: 'H5'
        })
      }).catch(() => {});
      // #endregion
      console.error("❌ Cannot create appointment: No scheduledAt time provided");
    }
  } else {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'route.ts:handleFunctionCall:conditions-not-met',
        message: 'bookAppointment conditions not met',
        data: {
          functionName: functionName,
          agencyId: agencyId,
          leadId: leadId,
          isBookAppointment: functionName === "bookAppointment",
          hasAgencyId: !!agencyId,
          hasLeadId: !!leadId,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'webhook-process',
        hypothesisId: 'H5'
      })
    }).catch(() => {});
    // #endregion
    console.log(`⚠️ Function call ${functionName} - conditions not met or not bookAppointment`);
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'route.ts:createAppointment:before-insert',
      message: 'About to insert appointment',
      data: {
        agencyId: data.agencyId,
        leadId: data.leadId,
        agentId: data.agentId,
        scheduledAt: data.scheduledAt,
        notes: data.notes,
        callId: data.callId,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'webhook-process',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  const { data: appointment, error } = await supabaseAdmin.from("appointments").insert({
    agency_id: data.agencyId,
    lead_id: data.leadId,
    agent_id: data.agentId,
    call_id: data.callId,
    scheduled_at: data.scheduledAt,
    notes: data.notes,
    status: "scheduled",
  }).select().single();

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'route.ts:createAppointment:after-insert',
      message: 'Appointment insert result',
      data: {
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        appointmentId: appointment?.id,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'webhook-process',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  if (error) {
    console.error("❌ Error creating appointment:", error);
  } else {
    console.log(`✅ Appointment created: ${appointment?.id} for lead ${data.leadId}`);
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

