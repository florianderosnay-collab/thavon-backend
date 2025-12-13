# Domain Migration Guide: From thavon.vercel.app to Custom Domain

## Domain Options Analysis

### Option 1: `app.thavon.io` ⭐ **RECOMMENDED**
**Pros:**
- ✅ Professional and clean
- ✅ Common SaaS pattern (app.company.com)
- ✅ Allows you to use `thavon.io` for marketing site later
- ✅ Easy to remember
- ✅ Subdomain is usually cheaper/free with domain ownership

**Cons:**
- ⚠️ Requires DNS configuration (CNAME record)

### Option 2: `thavon.app`
**Pros:**
- ✅ Very clean and short
- ✅ Modern TLD (.app)
- ✅ No subdomain needed

**Cons:**
- ⚠️ `.app` domains are more expensive (~$15-20/year)
- ⚠️ You'd need to purchase the domain
- ⚠️ Can't use `thavon.io` for marketing site (different domain)

### Option 3: `thavon.io`
**Pros:**
- ✅ Cleanest option
- ✅ Root domain (most professional)

**Cons:**
- ⚠️ If you want a marketing site later, you'd need a subdomain anyway
- ⚠️ Less flexible for future expansion

## Recommendation: `app.thavon.io`

**Why?**
- Professional and scalable
- Allows `thavon.io` for marketing/landing page
- Common SaaS pattern users recognize
- Free if you already own `thavon.io`

---

## Migration Steps

### Step 1: Purchase/Verify Domain Ownership

If you don't own `thavon.io`:
1. Purchase from a registrar (Namecheap, Google Domains, etc.)
2. Wait for DNS propagation (usually instant to 24 hours)

If you already own it:
- Skip to Step 2

### Step 2: Add Custom Domain in Vercel

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your **Thavon** project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `app.thavon.io`
6. Vercel will show you DNS records to add:
   - **Type**: CNAME
   - **Name**: `app` (or `@` if using root domain)
   - **Value**: `cname.vercel-dns.com` (or similar)

### Step 3: Configure DNS

1. Go to your domain registrar's DNS settings
2. Add a CNAME record:
   - **Name**: `app`
   - **Value**: `cname.vercel-dns.com` (or what Vercel shows)
   - **TTL**: 3600 (or default)

3. Wait for DNS propagation (5 minutes to 48 hours, usually 15-30 minutes)

### Step 4: Verify Domain in Vercel

1. Go back to Vercel → Settings → Domains
2. Click **Refresh** next to your domain
3. Wait for status to show **Valid Configuration**
4. Vercel will automatically provision SSL certificate

### Step 5: Update Environment Variables

**In Vercel:**
1. Go to **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_BASE_URL`:
   - **Old**: `https://thavon.vercel.app`
   - **New**: `https://app.thavon.io`
3. Click **Save**

**In Local Development (.env.local):**
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
(Keep localhost for local dev)

### Step 6: Update Supabase Redirect URLs

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, update:
   - **Remove**: `https://thavon.vercel.app/auth/callback`
   - **Add**: `https://app.thavon.io/auth/callback`
   - **Keep**: `http://localhost:3000/auth/callback` (for local dev)

5. Under **Site URL**, update:
   - **Production**: `https://app.thavon.io`
   - **Local**: `http://localhost:3000` (keep this)

### Step 7: Update Google OAuth Settings

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Under **Authorized domains**, add:
   - `thavon.io` (root domain)
   - This will make "to continue to thavon.io" appear

4. Go to **APIs & Services** → **Credentials**
5. Find your OAuth 2.0 Client ID
6. The redirect URI should still be the Supabase URL (no change needed):
   - `https://[your-supabase-project].supabase.co/auth/v1/callback`

### Step 8: Update Integration OAuth Apps

**HubSpot:**
1. Go to HubSpot Settings → Integrations → Private Apps
2. Update redirect URI:
   - **Old**: `https://thavon.vercel.app/api/integrations/callback/hubspot`
   - **New**: `https://app.thavon.io/api/integrations/callback/hubspot`

**Salesforce:**
1. Go to Salesforce Setup → App Manager
2. Edit your Connected App
3. Update callback URL:
   - **Old**: `https://thavon.vercel.app/api/integrations/callback/salesforce`
   - **New**: `https://app.thavon.io/api/integrations/callback/salesforce`

### Step 9: Update Documentation Files

I'll update these files automatically, but here's what needs changing:
- `GOOGLE_AUTH_SETUP.md`
- `INTEGRATION_SETUP_GUIDE.md`
- `INTEGRATIONS_SETUP.md`
- `frontend/app/integrations/docs/page.tsx` (hardcoded URLs)

### Step 10: Update Hardcoded URLs in Code

**Files to update:**
- `frontend/app/api/support/send-email/route.ts` (fallback URL)
- `frontend/app/integrations/docs/page.tsx` (example URLs)

### Step 11: Test Everything

**Checklist:**
- [ ] Domain loads at `https://app.thavon.io`
- [ ] SSL certificate is valid (green lock icon)
- [ ] Google OAuth login works
- [ ] Supabase redirects work
- [ ] HubSpot integration connects
- [ ] Salesforce integration connects
- [ ] Stripe checkout redirects work
- [ ] Email links work (support tickets)
- [ ] Webhook URLs work (if any external services use them)

### Step 12: Update External Services (if any)

If you have any external services configured with webhooks:
- Zapier webhooks
- Facebook Lead Ads
- Pipedrive webhooks
- Any other integrations

Update their webhook URLs to use `https://app.thavon.io/...`

---

## Code Changes Summary

### Environment Variables (No Code Changes Needed!)
✅ **Good news**: Your code already uses `process.env.NEXT_PUBLIC_BASE_URL` everywhere, so you only need to:
- Update the environment variable in Vercel
- That's it! No code changes required.

### Files with Hardcoded URLs (Need Updates)

These files have hardcoded `thavon.vercel.app` that should be updated:

1. **Documentation files** (for user reference):
   - `GOOGLE_AUTH_SETUP.md`
   - `INTEGRATION_SETUP_GUIDE.md`
   - `INTEGRATIONS_SETUP.md`

2. **Code files** (fallback URLs):
   - `frontend/app/api/support/send-email/route.ts` (line 73)
   - `frontend/app/integrations/docs/page.tsx` (multiple lines)

---

## Rollback Plan

If something goes wrong:
1. Keep `thavon.vercel.app` active in Vercel (don't remove it)
2. Revert `NEXT_PUBLIC_BASE_URL` to `https://thavon.vercel.app`
3. Revert Supabase redirect URLs
4. Everything should work again

---

## Timeline

- **DNS Setup**: 15-30 minutes (usually)
- **Vercel Configuration**: 5 minutes
- **Environment Variables**: 2 minutes
- **Supabase Updates**: 5 minutes
- **OAuth App Updates**: 10-15 minutes
- **Testing**: 15-30 minutes
- **Total**: ~1-2 hours

---

## Cost

- **Domain**: If you don't own `thavon.io`, ~$10-15/year
- **Vercel**: Free (custom domains included)
- **SSL**: Free (automatic via Vercel)
- **Total**: Just domain cost (if needed)

---

## Next Steps

1. Decide on domain: `app.thavon.io` (recommended) or `thavon.app`
2. Purchase/verify domain ownership
3. Follow steps above
4. I can help update the code files once you confirm the domain choice


