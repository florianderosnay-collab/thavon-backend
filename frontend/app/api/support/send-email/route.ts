import { NextResponse } from "next/server";

/**
 * Send email notification when a support ticket is created
 * Uses Resend API (https://resend.com)
 * 
 * To set up:
 * 1. Sign up at https://resend.com
 * 2. Get your API key from the dashboard
 * 3. Add RESEND_API_KEY to your .env.local
 * 4. Verify your domain or use the test domain
 */
export async function POST(req: Request) {
  try {
    const { ticket, type } = await req.json();

    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured. Skipping email notification.");
      return NextResponse.json({ 
        success: false, 
        message: "Email service not configured" 
      });
    }

    // Determine email content based on type
    let emailSubject: string;
    let emailHtml: string;
    let recipientEmail: string;

    if (type === "admin_notification") {
      // Email to admin/support team
      recipientEmail = process.env.ADMIN_EMAIL || "support@thavon.com";
      emailSubject = `[${ticket.priority.toUpperCase()}] New Support Ticket: ${ticket.subject}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .ticket-info { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
              .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
              .priority-low { background: #e5e7eb; color: #374151; }
              .priority-medium { background: #dbeafe; color: #1e40af; }
              .priority-high { background: #fed7aa; color: #9a3412; }
              .priority-critical { background: #fee2e2; color: #991b1b; }
              .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New Support Ticket</h1>
              </div>
              <div class="content">
                <div class="ticket-info">
                  <h2 style="margin-top: 0;">${ticket.subject}</h2>
                  <p><strong>From:</strong> ${ticket.name} (${ticket.email})</p>
                  <p><strong>Category:</strong> ${ticket.category}</p>
                  <p><strong>Priority:</strong> 
                    <span class="priority-badge priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span>
                  </p>
                  <p><strong>Created:</strong> ${new Date(ticket.created_at).toLocaleString()}</p>
                </div>
                <div class="ticket-info">
                  <h3>Message:</h3>
                  <p style="white-space: pre-wrap;">${ticket.message}</p>
                </div>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://thavon.vercel.app'}/admin/support" class="button">
                  View in Admin Dashboard
                </a>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      // Confirmation email to customer
      recipientEmail = ticket.email;
      emailSubject = `We've received your support request: ${ticket.subject}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .ticket-info { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Thank You for Contacting Us</h1>
              </div>
              <div class="content">
                <p>Hi ${ticket.name},</p>
                <p>We've received your support request and our team will get back to you soon.</p>
                <div class="ticket-info">
                  <p><strong>Ticket ID:</strong> ${ticket.id.substring(0, 8)}...</p>
                  <p><strong>Subject:</strong> ${ticket.subject}</p>
                  <p><strong>Priority:</strong> ${ticket.priority}</p>
                </div>
                <p>Expected response time:</p>
                <ul>
                  <li><strong>Critical:</strong> Within 2 hours</li>
                  <li><strong>High:</strong> Within 4 hours</li>
                  <li><strong>Medium:</strong> Within 24 hours</li>
                  <li><strong>Low:</strong> Within 48 hours</li>
                </ul>
                <p>If you have any additional information, please reply to this email.</p>
                <p>Best regards,<br>The Thavon Support Team</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Thavon <onboarding@resend.dev>",
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Resend API error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to send email" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, messageId: data.id });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

