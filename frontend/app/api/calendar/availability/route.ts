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
 * Check agent's calendar availability
 * GET /api/calendar/availability?agent_id=xxx&start_time=xxx&end_time=xxx
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const auth = await getAuthenticatedUserAndAgency(req);
    if (!auth) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id");
    const startTime = searchParams.get("start_time");
    const endTime = searchParams.get("end_time");

    if (!agentId || !startTime || !endTime) {
      return NextResponse.json(
        { status: "error", message: "agent_id, start_time, and end_time are required" },
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

    // Decrypt access token
    let accessToken = decrypt(agent.google_calendar_access_token);
    
    // Check if token is expired and refresh if needed
    if (agent.google_calendar_expires_at && new Date(agent.google_calendar_expires_at) < new Date()) {
      accessToken = await refreshCalendarToken(agentId, agent.google_calendar_refresh_token);
    }

    // Query Google Calendar for busy times
    const calendarId = agent.google_calendar_id || "primary";
    const freebusyUrl = new URL("https://www.googleapis.com/calendar/v3/freeBusy");
    
    const freebusyResponse = await fetch(freebusyUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: startTime,
        timeMax: endTime,
        items: [{ id: calendarId }],
      }),
    });

    if (!freebusyResponse.ok) {
      const error = await freebusyResponse.text();
      console.error("❌ Google Calendar API error:", error);
      return NextResponse.json(
        { status: "error", message: "Failed to check calendar availability" },
        { status: 500 }
      );
    }

    const freebusyData = await freebusyResponse.json();
    const busySlots = freebusyData.calendars?.[calendarId]?.busy || [];

    // Calculate available slots
    const start = new Date(startTime);
    const end = new Date(endTime);
    const available = busySlots.length === 0; // Available if no busy slots

    return NextResponse.json({
      status: "ok",
      available,
      busySlots,
      startTime,
      endTime,
    });
  } catch (error: any) {
    console.error("❌ Error checking calendar availability:", error);
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

