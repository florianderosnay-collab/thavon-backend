import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    // SECURITY: Verify user is authenticated and get their agency
    const authData = await getAuthenticatedUserAndAgency(req);
    if (!authData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("id");

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify the lead belongs to the user's agency
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("agency_id")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // SECURITY: Verify user owns the agency that owns this lead
    if (lead.agency_id !== authData.agencyId) {
      return NextResponse.json(
        { error: "Access denied: You can only delete leads from your own agency" },
        { status: 403 }
      );
    }

    // Delete the lead
    const { error: deleteError } = await supabaseAdmin
      .from("leads")
      .delete()
      .eq("id", leadId)
      .eq("agency_id", authData.agencyId); // Double-check agency ownership

    if (deleteError) {
      console.error("Delete lead error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


