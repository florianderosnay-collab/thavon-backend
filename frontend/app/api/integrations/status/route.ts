import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agencyId = searchParams.get("agencyId");

    if (!agencyId) {
      return NextResponse.json(
        { error: "Agency ID is required" },
        { status: 400 }
      );
    }

    // Fetch all integrations for this agency
    const { data: integrations, error } = await supabaseAdmin
      .from("agency_integrations")
      .select("*")
      .eq("agency_id", agencyId);

    if (error) {
      console.error("Error fetching integrations:", error);
      return NextResponse.json(
        { error: "Failed to fetch integrations" },
        { status: 500 }
      );
    }

    // Transform to frontend format
    const statusMap: Record<string, "connected" | "disconnected"> = {};
    integrations?.forEach((integration) => {
      statusMap[integration.integration_id] = 
        integration.status === "connected" ? "connected" : "disconnected";
    });

    return NextResponse.json({ statusMap });
  } catch (error: any) {
    console.error("Status fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

