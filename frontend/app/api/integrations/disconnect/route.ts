import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // Delete the integration record
    const { error } = await supabaseAdmin
      .from("agency_integrations")
      .delete()
      .eq("agency_id", agencyId)
      .eq("integration_id", integrationId);

    if (error) {
      console.error("Disconnect error:", error);
      return NextResponse.json(
        { error: "Failed to disconnect integration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

