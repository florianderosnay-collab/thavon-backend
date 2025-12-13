import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

// Resend API key
const resendApiKey = process.env.RESEND_API_KEY;

/**
 * Send call summary notifications via email
 * Sends to both agency owner and assigned agent (if any)
 */
export async function POST(req: NextRequest) {
  try {
    const { callLogId } = await req.json();

    if (!callLogId) {
      return NextResponse.json(
        { status: "error", message: "callLogId is required" },
        { status: 400 }
      );
    }

    // Fetch call log with related data
    const { data: callLog, error: callError } = await supabaseAdmin
      .from("call_logs")
      .select(`
        *,
        leads:lead_id (name, phone_number, address),
        agents:agent_id (name, email)
      `)
      .eq("id", callLogId)
      .single();

    if (callError || !callLog) {
      console.error("❌ Error fetching call log:", callError);
      return NextResponse.json(
        { status: "error", message: "Call log not found" },
        { status: 404 }
      );
    }

    // Get agency owner email
    const { data: owner } = await supabaseAdmin
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", callLog.agency_id)
      .eq("role", "owner")
      .single();

    let ownerEmail: string | null = null;
    if (owner) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
      ownerEmail = user?.user?.email || null;
    }

    // Prepare email data
    const callDate = new Date(callLog.created_at).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const duration = callLog.duration_seconds
      ? `${Math.floor(callLog.duration_seconds / 60)}:${(callLog.duration_seconds % 60).toString().padStart(2, "0")}`
      : "N/A";

    const leadName = callLog.leads?.name || "Unknown Lead";
    const leadPhone = callLog.leads?.phone_number || "N/A";
    const agentName = callLog.agents?.name || "Unassigned";
    const agencyName = "Your Agency"; // Agencies table doesn't have a name column

    // Email subject
    const subject = `Call Summary: ${leadName} - ${callDate}`;

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Call Summary</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📞 Call Summary</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">Call Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Lead:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 600;">${leadName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Phone:</td>
                  <td style="padding: 8px 0; color: #111827;">${leadPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Agent:</td>
                  <td style="padding: 8px 0; color: #111827;">${agentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Date & Time:</td>
                  <td style="padding: 8px 0; color: #111827;">${callDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Duration:</td>
                  <td style="padding: 8px 0; color: #111827;">${duration}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Status:</td>
                  <td style="padding: 8px 0;">
                    <span style="background: ${callLog.status === "completed" ? "#10b981" : "#f59e0b"}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                      ${callLog.status}
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            ${callLog.summary ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">Call Summary</h2>
              <p style="color: #374151; line-height: 1.8; margin: 0;">${callLog.summary}</p>
            </div>
            ` : ""}

            ${callLog.transcript ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">Full Transcript</h2>
              <div style="background: #f9fafb; padding: 15px; border-radius: 6px; max-height: 300px; overflow-y: auto; color: #4b5563; font-size: 14px; line-height: 1.6;">
                ${callLog.transcript}
              </div>
            </div>
            ` : ""}

            ${callLog.recording_url ? `
            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;">
              <h2 style="margin-top: 0; color: #1f2937; font-size: 20px;">Call Recording</h2>
              <a href="${callLog.recording_url}" 
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 10px;">
                🎧 Listen to Recording
              </a>
            </div>
            ` : ""}

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                View full call details in your <a href="${process.env.NEXT_PUBLIC_BASE_URL || "https://app.thavon.io"}/calls" style="color: #667eea; text-decoration: none;">Call History</a>
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This is an automated email from ${agencyName} via Thavon AI</p>
            <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Thavon. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    // Validate Resend API key
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Skipping email notification.");
      return NextResponse.json({
        status: "ok",
        message: "Email service not configured",
        sent: 0,
        failed: 0,
      });
    }

    // Send emails
    const emailPromises: Promise<any>[] = [];

    // Send to agency owner
    if (ownerEmail) {
      emailPromises.push(
        sendEmailViaResend(
          resendApiKey,
          ownerEmail,
          subject,
          emailHtml
        )
      );
    }

    // Send to assigned agent (if different from owner)
    if (callLog.agents?.email && callLog.agents.email !== ownerEmail) {
      emailPromises.push(
        sendEmailViaResend(
          resendApiKey,
          callLog.agents.email,
          subject,
          emailHtml
        )
      );
    }

    // Send all emails
    const results = await Promise.allSettled(emailPromises);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📧 Sent ${sent} email(s), ${failed} failed`);

    return NextResponse.json({
      status: "ok",
      message: `Sent ${sent} email notification(s)`,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error("❌ Error sending call summary email:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

/**
 * Send email via Resend API
 */
async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<any> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Thavon <noreply@thavon.io>",
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

