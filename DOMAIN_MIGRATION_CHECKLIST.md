# Domain Migration Checklist: app.thavon.io

## ✅ Code Updates (DONE)

All hardcoded URLs have been updated from `thavon.vercel.app` to `app.thavon.io`:

## 📋 Vercel Domain Management

### Keep or Delete Old Domain?

**Recommendation: KEEP for now, DELETE later**

1. **Keep `thavon.vercel.app` active** (don't delete yet)
   - Acts as a backup if something goes wrong
   - Allows gradual migration
   - No cost to keep it

2. **After 1-2 weeks of successful operation**:
   - Test that `app.thavon.io` works perfectly
   - Verify all integrations work
   - Then you can safely remove `thavon.vercel.app`

3. **To remove later**:
   - Go to Vercel → Settings → Domains
   - Click "Remove" next to `thavon.vercel.app`
   - Confirm deletion

**Note**: You can also set up a redirect from `thavon.vercel.app` → `app.thavon.io` if you want, but it's not necessary.

- [x] `frontend/app/api/support/send-email/route.ts` - Updated fallback URL
- [x] `frontend/app/integrations/docs/page.tsx` - Updated all example URLs (5 places)
- [x] `GOOGLE_AUTH_SETUP.md` - Updated documentation
- [x] `INTEGRATION_SETUP_GUIDE.md` - Updated documentation
- [x] `GOOGLE_AUTH_BRANDING.md` - Updated documentation

## ⚠️ Action Required: External Services Configuration

### 1. Vercel Environment Variables

**Action**: Update environment variable in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `NEXT_PUBLIC_BASE_URL`
3. Update from: `https://thavon.vercel.app`
4. Update to: `https://app.thavon.io`
5. Click **Save**
6. **Redeploy** your application (or wait for next deployment)

**Status**: ⚠️ **TODO**

---

### 2. Supabase Redirect URLs

**Action**: Update redirect URLs in Supabase

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**:
   - **Remove**: `https://thavon.vercel.app/auth/callback`
   - **Add**: `https://app.thavon.io/auth/callback`
   - **Keep**: `http://localhost:3000/auth/callback` (for local dev)
5. Under **Site URL**:
   - **Update**: `https://app.thavon.io` (production)
   - **Keep**: `http://localhost:3000` (local)

**Status**: ⚠️ **TODO**

---

### 3. Google OAuth Settings

**Action**: Update authorized domains in Google Cloud Console

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Under **Authorized domains**:
   - **Add**: `thavon.io` (root domain - this makes "to continue to thavon.io" appear)
4. Under **Application Information**:
   - **Application home page**: `https://app.thavon.io`
   - **Application name**: `Thavon` (or your preferred name)

**Note**: The OAuth redirect URI in Google Cloud Console should still point to Supabase:
- `https://[your-supabase-project].supabase.co/auth/v1/callback`
- **DO NOT** change this - it's correct as-is

**Status**: ⚠️ **TODO**

---

### 4. HubSpot OAuth App

**Action**: Update redirect URI in HubSpot

1. Go to HubSpot Settings → Integrations → Private Apps
2. Find your Thavon integration app
3. Update **Redirect URI**:
   - **Old**: `https://thavon.vercel.app/api/integrations/callback/hubspot`
   - **New**: `https://app.thavon.io/api/integrations/callback/hubspot`
4. Save changes

**Status**: ⚠️ **TODO**

---

### 5. Salesforce Connected App

**Action**: Update callback URL in Salesforce

1. Go to Salesforce Setup → App Manager
2. Find your Thavon Connected App
3. Edit the app
4. Update **Callback URL**:
   - **Old**: `https://thavon.vercel.app/api/integrations/callback/salesforce`
   - **New**: `https://app.thavon.io/api/integrations/callback/salesforce`
5. Save changes

**Status**: ⚠️ **TODO**

---

### 6. Stripe Webhooks (if configured)

**Action**: Update webhook endpoints in Stripe (if you have any)

1. Go to Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Developers** → **Webhooks**
3. For each webhook endpoint:
   - **Old**: `https://thavon.vercel.app/api/webhooks/...`
   - **New**: `https://app.thavon.io/api/webhooks/...`
4. Update and save

**Note**: Stripe webhooks are typically configured to call your app, not the other way around. Only update if you have webhook endpoints configured.

**Status**: ⚠️ **TODO** (if applicable)

---

### 7. External Webhook Services

**Action**: Update webhook URLs in external services

If you have any of these configured, update their webhook URLs:

- **Zapier**: Update webhook URLs to `https://app.thavon.io/api/webhooks/inbound/[agency-id]`
- **Facebook Lead Ads**: Update webhook URL
- **Pipedrive**: Update webhook URL
- **Any other integrations**: Update webhook URLs

**Status**: ⚠️ **TODO** (if applicable)

---

### 8. Email Service (Resend)

**Action**: Update email links (if using Resend)

The email service already uses `NEXT_PUBLIC_BASE_URL` environment variable, so once you update that in Vercel, email links will automatically use the new domain.

**Status**: ✅ **Automatic** (after Step 1)

---

## Testing Checklist

After completing all updates, test:

- [ ] Domain loads: Visit `https://app.thavon.io` - should show your app
- [ ] SSL certificate: Check for green lock icon (HTTPS)
- [ ] Google OAuth login: Try logging in with Google
- [ ] Email/password login: Try regular login
- [ ] Dashboard loads: Should see dashboard after login
- [ ] HubSpot integration: Try connecting HubSpot
- [ ] Salesforce integration: Try connecting Salesforce
- [ ] Webhook test: Test inbound webhook (if applicable)
- [ ] Email links: Check that email links in support tickets work
- [ ] Stripe checkout: Test upgrade flow (if applicable)

---

## Rollback Plan

If something breaks:

1. **Revert Vercel environment variable**:
   - Change `NEXT_PUBLIC_BASE_URL` back to `https://thavon.vercel.app`
   - Redeploy

2. **Revert Supabase redirect URLs**:
   - Add back `https://thavon.vercel.app/auth/callback`
   - Remove `https://app.thavon.io/auth/callback`

3. **Revert OAuth apps**:
   - Update HubSpot and Salesforce back to old URLs

4. **Keep both domains active**:
   - Don't remove `thavon.vercel.app` from Vercel
   - Both domains can work simultaneously during migration

---

## Priority Order

Do these in order:

1. **Vercel Environment Variable** (Step 1) - Most important
2. **Supabase Redirect URLs** (Step 2) - Required for auth
3. **Google OAuth** (Step 3) - Required for Google login
4. **HubSpot/Salesforce** (Steps 4-5) - Required for integrations
5. **External Webhooks** (Steps 6-7) - If applicable

---

## Estimated Time

- **Vercel**: 2 minutes
- **Supabase**: 3 minutes
- **Google OAuth**: 5 minutes
- **HubSpot**: 3 minutes
- **Salesforce**: 3 minutes
- **Testing**: 15-20 minutes
- **Total**: ~30-40 minutes

---

## Need Help?

If you encounter issues:
1. Check browser console for errors (F12)
2. Check Vercel deployment logs
3. Verify DNS propagation: `dig app.thavon.io` or use https://dnschecker.org
4. Test with both domains temporarily (old and new)

