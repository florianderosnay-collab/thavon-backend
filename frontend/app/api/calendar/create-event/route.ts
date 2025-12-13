import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

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
 * Create a calendar event in agent's Google Calendar
 * POST /api/calendar/create-event
 * Body: { agent_id, lead_id, scheduled_at, notes, title }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const auth = await getAuthenticatedUserAndAgency(req);
    if (!auth) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { agent_id: agentId, lead_id: leadId, scheduled_at: scheduledAt, notes, title } = body;

    if (!agentId || !leadId || !scheduledAt) {
      return NextResponse.json(
        { status: "error", message: "agent_id, lead_id, and scheduled_at are required" },
        { status: 400 }
      );
    }

    // Fetch agent with calendar credentials
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("agency_id", auth.agencyId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { status: "error", message: "Agent not found" },
        { status: 404 }
      );
    }

    if (!agent.calendar_sync_enabled || !agent.google_calendar_access_token) {
      return NextResponse.json(
        { status: "error", message: "Calendar not connected for this agent" },
        { status: 400 }
      );
    }

    // Fetch lead information
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("name, phone_number, address")
      .eq("id", leadId)
      .single();

    // Decrypt access token
    let accessToken = decrypt(agent.google_calendar_access_token);
    
    // Check if token is expired and refresh if needed
    if (agent.google_calendar_expires_at && new Date(agent.google_calendar_expires_at) < new Date()) {
      accessToken = await refreshCalendarToken(agentId, agent.google_calendar_refresh_token);
    }

    // Build calendar event
    const eventTitle = title || `Appointment with ${lead?.name || "Lead"}`;
    const eventDescription = notes || `Appointment scheduled via Thavon AI\n\nLead: ${lead?.name || "N/A"}\nPhone: ${lead?.phone_number || "N/A"}\nAddress: ${lead?.address || "N/A"}`;

    const eventStart = new Date(scheduledAt).toISOString();
    const eventEnd = new Date(new Date(scheduledAt).getTime() + 60 * 60 * 1000).toISOString(); // 1 hour default

    const calendarEvent = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: eventStart,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: eventEnd,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 24 hours before
          { method: "popup", minutes: 30 }, // 30 minutes before
        ],
      },
    };

    // Create event in Google Calendar
    const calendarId = agent.google_calendar_id || "primary";
    const createEventUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    const eventResponse = await fetch(createEventUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(calendarEvent),
    });

    if (!eventResponse.ok) {
      const error = await eventResponse.text();
      console.error("❌ Google Calendar API error:", error);
      return NextResponse.json(
        { status: "error", message: "Failed to create calendar event" },
        { status: 500 }
      );
    }

    const eventData = await eventResponse.json();
    const calendarEventId = eventData.id;

    // Update appointment record with calendar event ID
    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("lead_id", leadId)
      .eq("agent_id", agentId)
      .eq("scheduled_at", scheduledAt)
      .single();

    if (appointment) {
      await supabaseAdmin
        .from("appointments")
        .update({
          calendar_event_id: calendarEventId,
          calendar_provider: "google",
        })
        .eq("id", appointment.id);
    }

    return NextResponse.json({
      status: "ok",
      message: "Calendar event created successfully",
      eventId: calendarEventId,
      eventUrl: eventData.htmlLink,
    });
  } catch (error: any) {
    console.error("❌ Error creating calendar event:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Refresh Google Calendar access token
 */
async function refreshCalendarToken(
  agentId: string,
  encryptedRefreshToken: string | null
): Promise<string> {
  if (!encryptedRefreshToken) {
    throw new Error("No refresh token available");
  }

  const refreshToken = decrypt(encryptedRefreshToken);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error("Failed to refresh token");
  }

  const tokens = await tokenResponse.json();
  const { access_token, expires_in } = tokens;

  // Update agent with new token
  const expiresAt = expires_in
    ? new Date(Date.now() + expires_in * 1000).toISOString()
    : null;

  const { encrypt } = await import("@/lib/encryption");
  const encryptedAccessToken = encrypt(access_token);

  await supabaseAdmin
    .from("agents")
    .update({
      google_calendar_access_token: encryptedAccessToken,
      google_calendar_expires_at: expiresAt,
    })
    .eq("id", agentId);

  return access_token;
}

