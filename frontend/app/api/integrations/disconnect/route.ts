import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // SECURITY: Verify user is authenticated and get their agency
    const authData = await getAuthenticatedUserAndAgency(req);
    if (!authData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify user owns the agency they're trying to disconnect
    if (authData.agencyId !== agencyId) {
      return NextResponse.json(
        { error: "Access denied: You can only disconnect integrations for your own agency" },
        { status: 403 }
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

