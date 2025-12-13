import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserAndAgency } from "@/lib/auth-helpers";
import { validateAndSanitize, settingsSchema } from "@/lib/validation";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: Request) {
  try {
    // SECURITY: Verify user is authenticated and get their agency
    const authData = await getAuthenticatedUserAndAgency(req);
    if (!authData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // SECURITY: Validate and sanitize input
    const validation = validateAndSanitize(settingsSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { companyName, phone } = validation.data;

    // Update agency settings
    const { error: updateError } = await supabaseAdmin
      .from("agencies")
      .update({
        company_name: companyName,
        owner_phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authData.agencyId); // SECURITY: Only update user's own agency

    if (updateError) {
      console.error("Update settings error:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
    });
  } catch (error: any) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

