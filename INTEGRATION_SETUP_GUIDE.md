# Integration Setup Guide

This guide will help you set up the three new features: Admin Dashboard, Email Notifications, and Live Chat.

## 1. Admin Dashboard for Support Tickets

### Access
- Navigate to: `/admin/support`
- This page shows all support tickets with filtering, search, and management capabilities

### Features
- ✅ View all support tickets
- ✅ Filter by status and priority
- ✅ Search tickets
- ✅ Update ticket status
- ✅ Add admin notes
- ✅ Reply via email

### Security Note
⚠️ **Important**: The admin dashboard currently doesn't have authentication. You should add role-based access control. For now, you can protect it by:
1. Adding a check in the API route (`/api/admin/support/tickets/route.ts`)
2. Adding middleware to protect `/admin/*` routes
3. Creating an `admin_users` table to track who has admin access

## 2. Email Notifications (Resend)

### Setup Steps

1. **Sign up for Resend**
   - Go to https://resend.com
   - Create a free account (100 emails/day free tier)

2. **Get your API Key**
   - Go to API Keys in the dashboard
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Add to Environment Variables**
   - Add to `frontend/.env.local`:
     ```env
     RESEND_API_KEY=re_your_api_key_here
     RESEND_FROM_EMAIL=Thavon <noreply@yourdomain.com>
     ADMIN_EMAIL=support@yourdomain.com
     ```

4. **Verify Your Domain (Optional but Recommended)**
   - In Resend dashboard, go to Domains
   - Add your domain (e.g., `thavon.com`)
   - Add the DNS records provided
   - Once verified, update `RESEND_FROM_EMAIL` to use your domain

5. **Test**
   - Submit a support ticket
   - Check that you receive:
     - Confirmation email (to customer)
     - Notification email (to admin)

### Email Templates
- Customer confirmation: Sent when ticket is created
- Admin notification: Sent to admin team when new ticket arrives

## 3. Live Chat (Crisp)

### Setup Steps

1. **Sign up for Crisp**
   - Go to https://crisp.chat
   - Create a free account

2. **Get your Website ID**
   - After creating your account, go to Settings → Website Settings
   - Copy your Website ID (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

3. **Add to Environment Variables**
   - Add to `frontend/.env.local`:
     ```env
     NEXT_PUBLIC_CRISP_WEBSITE_ID=your-website-id-here
     ```

4. **Deploy**
   - The chat widget will automatically appear on the support page
   - It will also appear on other pages if you add the script globally

### Customization
- Go to Crisp dashboard → Settings → Chatbox
- Customize colors, position, greeting messages, etc.

### Adding to Other Pages
To add Crisp chat to other pages, add this to your layout or specific pages:

```tsx
import Script from "next/script";

{process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID && (
  <Script id="crisp-chat" strategy="afterInteractive">
    {`
      window.$crisp=[];
      window.CRISP_WEBSITE_ID="${process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID}";
      (function(){
        d=document;
        s=d.createElement("script");
        s.src="https://client.crisp.chat/l.js";
        s.async=1;
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    `}
  </Script>
)}
```

## Complete Environment Variables

Add these to your `frontend/.env.local`:

```env
# Resend Email Service
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=Thavon <noreply@yourdomain.com>
ADMIN_EMAIL=support@yourdomain.com

# Crisp Live Chat
NEXT_PUBLIC_CRISP_WEBSITE_ID=your-website-id-here

# Base URL (for email links)
NEXT_PUBLIC_BASE_URL=https://thavon.vercel.app
```

## Testing Checklist

- [ ] Admin dashboard loads at `/admin/support`
- [ ] Can view all support tickets
- [ ] Can filter and search tickets
- [ ] Can update ticket status
- [ ] Can add admin notes
- [ ] Customer receives confirmation email when submitting ticket
- [ ] Admin receives notification email when ticket is created
- [ ] Crisp chat widget appears on support page
- [ ] Can send messages through Crisp chat

## Troubleshooting

### Emails not sending
- Check `RESEND_API_KEY` is set correctly
- Verify domain in Resend (or use test domain)
- Check Resend dashboard for error logs
- Check browser console for API errors

### Crisp chat not appearing
- Verify `NEXT_PUBLIC_CRISP_WEBSITE_ID` is set
- Check that the ID is correct (no extra spaces)
- Clear browser cache
- Check browser console for errors

### Admin dashboard not loading tickets
- Check that `support_tickets` table exists
- Verify API route is accessible
- Check browser console for errors
- Verify Supabase connection

## Next Steps

1. **Add Admin Authentication**
   - Create admin role system
   - Protect `/admin/*` routes
   - Add admin user management

2. **Email Improvements**
   - Add email templates for ticket updates
   - Send email when ticket status changes
   - Add email notifications for critical tickets

3. **Chat Enhancements**
   - Add chat to all pages
   - Configure automated responses
   - Set up chat routing rules

