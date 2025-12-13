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
 * Dashboard Metrics API
 * Returns live metrics for the authenticated user's agency
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

    // Calculate date ranges for week-over-week comparison
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. TOTAL LEADS: Count all leads for this agency
    const { count: totalLeads, error: leadsError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId);

    // Leads from this week
    const { count: leadsThisWeek } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .gte("created_at", oneWeekAgo.toISOString());

    // Leads from last week (for comparison)
    const { count: leadsLastWeek } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .gte("created_at", twoWeeksAgo.toISOString())
      .lt("created_at", oneWeekAgo.toISOString());

    // Calculate week-over-week change
    const leadsChange = leadsLastWeek && leadsLastWeek > 0
      ? Math.round(((leadsThisWeek || 0) - leadsLastWeek) / leadsLastWeek * 100)
      : 0;

    // 2. CALLS ATTEMPTED: Count from call_logs table (more accurate)
    const { count: callsAttempted, error: callsError } = await supabaseAdmin
      .from("call_logs")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId);
    
    // Also count from leads with call statuses as fallback
    const callStatuses = ['called', 'calling_inbound', 'voicemail', 'appointment_booked', 'no_answer', 'busy', 'callback'];
    const { count: leadsWithCalls } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .in("status", callStatuses);
    
    // Use whichever is higher (in case some calls aren't reflected in lead status yet)
    const totalCalls = Math.max(callsAttempted || 0, leadsWithCalls || 0);

    // Calculate connection rate (leads with appointments or successful calls / total calls)
    const { count: successfulCalls } = await supabaseAdmin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .in("status", ['appointment_booked', 'called']);

    const connectionRate = callsAttempted && callsAttempted > 0
      ? Math.round(((successfulCalls || 0) / callsAttempted) * 100)
      : 0;

    // 3. APPOINTMENTS: Count from appointments table (more accurate)
    const { count: appointments, error: appointmentsError } = await supabaseAdmin
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .gte("scheduled_at", new Date().toISOString()); // Only future/upcoming appointments

    // Get next appointment
    const { data: nextAppointment } = await supabaseAdmin
      .from("appointments")
      .select(`
        scheduled_at,
        notes,
        leads (name, address)
      `)
      .eq("agency_id", agencyId)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .single();

    // Format next appointment info
    let nextAppointmentText = "No upcoming appointments";
    if (nextAppointment) {
      const appointmentTime = (nextAppointment as any).scheduled_at;
      if (appointmentTime) {
        const date = new Date(appointmentTime);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        // Handle leads as either object or array (Supabase relationship query)
        const leadsData = (nextAppointment as any).leads;
        const leadName = (Array.isArray(leadsData) ? leadsData[0]?.name : leadsData?.name) || "Lead";
        nextAppointmentText = `Next: ${day} ${time} with ${leadName}`;
      }
    }

    // 4. PIPELINE VALUE: Sum of asking_price * average commission rate
    // Assuming average commission is 3% (0.03) - you can make this configurable
    const AVG_COMMISSION_RATE = 0.03;

    const { data: leadsWithPrices, error: pipelineError } = await supabaseAdmin
      .from("leads")
      .select("asking_price")
      .eq("agency_id", agencyId)
      .not("asking_price", "is", null)
      .neq("asking_price", "0")
      .neq("asking_price", "");

    let pipelineValue = 0;
    if (leadsWithPrices) {
      pipelineValue = leadsWithPrices.reduce((sum, lead) => {
        // Handle various price formats: "€500000", "500,000", "$500000", "500000", etc.
        const priceStr = lead.asking_price?.toString() || "0";
        const cleanedPrice = priceStr.replace(/[€,$,\s]/g, "").replace(/,/g, "");
        const price = parseFloat(cleanedPrice) || 0;
        return sum + (price * AVG_COMMISSION_RATE);
      }, 0);
    }

    // Format pipeline value
    const formattedPipelineValue = pipelineValue >= 1000000
      ? `€${(pipelineValue / 1000000).toFixed(1)}M`
      : pipelineValue >= 1000
      ? `€${(pipelineValue / 1000).toFixed(1)}K`
      : `€${Math.round(pipelineValue)}`;

    if (leadsError || callsError || appointmentsError || pipelineError) {
      console.error("Error fetching metrics:", { leadsError, callsError, appointmentsError, pipelineError });
    }

    return NextResponse.json({
      totalLeads: totalLeads || 0,
      leadsChange: leadsChange,
      callsAttempted: callsAttempted || 0,
      connectionRate: connectionRate,
      appointments: appointments || 0,
      nextAppointment: nextAppointmentText,
      pipelineValue: formattedPipelineValue,
    });
  } catch (error: any) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

