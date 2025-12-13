import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "@/lib/encryption";

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
 * Initiate Google Calendar OAuth flow for an agent
 * GET /api/calendar/connect?agent_id=xxx
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication and agency ownership
    const auth = await getAuthenticatedUserAndAgency(req);
    if (!auth) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id");

    if (!agentId) {
      return NextResponse.json(
        { status: "error", message: "agent_id is required" },
        { status: 400 }
      );
    }

    // Verify agent belongs to user's agency
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("agency_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent || agent.agency_id !== auth.agencyId) {
      return NextResponse.json(
        { status: "error", message: "Agent not found or access denied" },
        { status: 403 }
      );
    }

    // Google OAuth configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/api/calendar/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { status: "error", message: "Google Calendar not configured" },
        { status: 500 }
      );
    }

    // Generate state parameter (includes agent_id and agency_id for security)
    const state = Buffer.from(
      JSON.stringify({
        agent_id: agentId,
        agency_id: auth.agencyId,
      })
    ).toString("base64");

    // Google OAuth scopes for Calendar API
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    // Build authorization URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
    authUrl.searchParams.set("state", state);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error("❌ Error initiating calendar OAuth:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

