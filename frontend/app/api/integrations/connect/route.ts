import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OAuth provider configurations
const OAUTH_PROVIDERS: Record<string, { authUrl: string; scopes: string[] }> = {
  hubspot: {
    authUrl: "https://app.hubspot.com/oauth/authorize",
    scopes: ["contacts", "crm.objects.contacts.read", "crm.objects.contacts.write"]
  },
  salesforce: {
    authUrl: "https://login.salesforce.com/services/oauth2/authorize",
    scopes: ["api", "refresh_token", "offline_access"]
  }
};

export async function POST(req: Request) {
  try {
    const { integrationId, agencyId } = await req.json();

    if (!integrationId || !agencyId) {
      return NextResponse.json(
        { error: "Integration ID and Agency ID are required" },
        { status: 400 }
      );
    }

    // Note: In production, add proper authentication here
    // For now, we rely on agencyId being passed from authenticated frontend

    // Verify agency ownership
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .select("id")
      .eq("id", agencyId)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json(
        { error: "Agency not found" },
        { status: 404 }
      );
    }

    // Handle OAuth providers
    if (integrationId === "hubspot" || integrationId === "salesforce") {
      const provider = OAUTH_PROVIDERS[integrationId];
      if (!provider) {
        return NextResponse.json(
          { error: "Unsupported OAuth provider" },
          { status: 400 }
        );
      }

      // Generate OAuth URL
      const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/integrations/callback/${integrationId}`;
      const state = Buffer.from(JSON.stringify({ agencyId, integrationId })).toString("base64");
      
      const params = new URLSearchParams({
        client_id: process.env[`${integrationId.toUpperCase()}_CLIENT_ID`] || "",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: provider.scopes.join(" "),
        state: state
      });

      const authUrl = `${provider.authUrl}?${params.toString()}`;

      return NextResponse.json({
        authUrl,
        state
      });
    }

    // For webhook-based integrations (Zapier, Pipedrive, Facebook), just return success
    // They'll configure the webhook URL themselves
    if (["zapier", "pipedrive", "facebook"].includes(integrationId)) {
      return NextResponse.json({
        success: true,
        message: "Webhook URL ready for configuration"
      });
    }

    return NextResponse.json(
      { error: "Unsupported integration type" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Integration connect error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

