import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use admin client to bypass RLS
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

// Import client for user auth
import { supabase } from "@/lib/supabaseClient";

/**
 * Recent Activity API
 * Returns recent lead activities for the authenticated user's agency
 */
export async function GET(req: Request) {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's agency membership
    const { data: member, error: memberError } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json(
        { error: "Agency membership not found" },
        { status: 404 }
      );
    }

    const agencyId = member.agency_id;

    // Fetch recent activity from call_logs (use admin client to bypass RLS)
    const { data: recentCalls, error: callsError } = await supabaseAdmin
      .from("call_logs")
      .select(`
        id,
        vapi_call_id,
        status,
        duration_seconds,
        created_at,
        lead_id
      `)
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    // Also fetch recent leads with activity
    const { data: recentLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, address, status, metadata, created_at, updated_at")
      .eq("agency_id", agencyId)
      .in("status", [
        "appointment_booked",
        "voicemail",
        "called",
        "calling_inbound",
        "objection_handled",
        "callback",
        "no_answer"
      ])
      .order("updated_at", { ascending: false })
      .limit(10);

    // Get lead data for call activities
    const leadIds = (recentCalls || []).map((c: any) => c.lead_id).filter(Boolean);
    const { data: leadsForCalls } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, address")
      .in("id", leadIds);
    
    const leadsMap = new Map((leadsForCalls || []).map((l: any) => [l.id, l]));
    
    // Combine call logs and lead activities
    const callActivities = (recentCalls || []).map((call: any) => {
      const leadData = leadsMap.get(call.lead_id) || {};
      return {
        id: call.id,
        type: call.status === "completed" ? "success" as const : "neutral" as const,
        title: `Call ${call.status}`,
        description: `${leadData.name || "Unknown"} - ${leadData.phone_number || ""}`,
        time: new Date(call.created_at).toLocaleString(),
        timestamp: call.created_at,
      };
    });

    const leadActivities = (recentLeads || []).map((lead) => {
      // Determine activity type and title based on status
      let type: "success" | "neutral" | "system" = "neutral";
      let title = "";
      let description = "";

      switch (lead.status) {
        case "appointment_booked":
          type = "success";
          title = "Appointment Booked";
          description = `${lead.name}${lead.address ? ` @ ${lead.address}` : ""}`;
          break;
        case "voicemail":
          type = "neutral";
          title = "Voicemail Drop";
          description = lead.phone_number ? `${lead.phone_number.slice(0, 10)}...` : "Unknown";
          break;
        case "called":
        case "calling_inbound":
          type = "neutral";
          title = "Call Completed";
          description = lead.name || lead.phone_number || "Unknown";
          break;
        case "objection_handled":
          type = "neutral";
          title = "Objection Handled";
          const objection = lead.metadata?.objection || "Objection";
          const response = lead.metadata?.response || "Overcome";
          description = `'${objection}' -> ${response}`;
          break;
        case "callback":
          type = "neutral";
          title = "Callback Scheduled";
          description = lead.name || lead.phone_number || "Unknown";
          break;
        case "no_answer":
          type = "neutral";
          title = "No Answer";
          description = lead.name || lead.phone_number || "Unknown";
          break;
        default:
          type = "neutral";
          title = "Activity";
          description = lead.name || "Unknown";
      }

      // Calculate relative time
      const updatedAt = new Date(lead.updated_at || lead.created_at);
      const now = new Date();
      const diffMs = now.getTime() - updatedAt.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let timeAgo = "";
      if (diffMins < 1) {
        timeAgo = "Just now";
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} ${diffMins === 1 ? "min" : "mins"} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
      } else {
        timeAgo = updatedAt.toLocaleDateString();
      }

      return {
        id: lead.id,
        type,
        title,
        description,
        time: timeAgo,
        timestamp: lead.updated_at || lead.created_at,
      };
    });

    return NextResponse.json({ activities });
  } catch (error: any) {
    console.error("Activity fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

