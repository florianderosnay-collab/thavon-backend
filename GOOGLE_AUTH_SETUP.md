# Google Authentication Setup Guide

## The Problem
Google OAuth is redirecting to `localhost:3000` instead of your production URL. This happens because:
1. The redirect URL needs to match what's configured in Supabase
2. Supabase needs both localhost (for development) and production URLs configured

## Solution

### Step 1: Configure Supabase Redirect URLs

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add BOTH:
   - `http://localhost:3000/auth/callback` (for local development)
   - `https://app.thavon.io/auth/callback` (for production)

5. Under **Site URL**, set:
   - Production: `https://app.thavon.io`
   - Local: `http://localhost:3000`

### Step 2: Set Environment Variable

Add to your `frontend/.env.local` (for local) and Vercel environment variables (for production):

```env
NEXT_PUBLIC_BASE_URL=https://app.thavon.io
```

**For local development**, you can either:
- Leave it unset (will use `window.location.origin` which is `localhost:3000`)
- Or set it to `http://localhost:3000`

### Step 3: Verify Google OAuth in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Make sure **Google** is enabled
3. Check that your Google OAuth credentials are configured:
   - Client ID
   - Client Secret

### Step 4: Configure Google Cloud Console OAuth Consent Screen

1. Go to https://console.cloud.google.com
2. Navigate to **APIs & Services** → **OAuth consent screen**
3. Configure the following:

   **Application Information:**
   - **App name**: `Thavon` (or your preferred name)
   - **User support email**: Your support email
   - **Application home page**: `https://thavon.io`
   - **Privacy policy link**: `https://thavon.io/privacy` (if you have one)
   - **Terms of service link**: `https://thavon.io/terms` (if you have one)

   **Authorized domains:**
   - Click **+ Add Domain**
   - Add: `thavon.io`
   - This will make "to continue to thavon.io" appear instead of the Supabase URL

4. **Verify OAuth 2.0 Client:**
   - Go to **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID
   - Under **Authorized redirect URIs**, make sure you have:
     - `https://[your-supabase-project].supabase.co/auth/v1/callback`
     - This is the Supabase callback URL, not your app URL

## How It Works

1. User clicks "Continue with Google" on your login page
2. Your app redirects to Supabase OAuth endpoint
3. Supabase redirects to Google
4. User authorizes on Google
5. Google redirects back to Supabase: `https://[project].supabase.co/auth/v1/callback`
6. Supabase processes the OAuth and redirects to your app: `[your-redirect-url]/auth/callback?code=...`
7. Your `/auth/callback` route exchanges the code for a session
8. User is logged in and redirected to dashboard

## Testing

### Local Development
1. Make sure `http://localhost:3000/auth/callback` is in Supabase redirect URLs
2. Run `npm run dev`
3. Try Google login - should work

### Production
1. Make sure `https://app.thavon.io/auth/callback` is in Supabase redirect URLs
2. Set `NEXT_PUBLIC_BASE_URL=https://app.thavon.io` in Vercel
3. Deploy and test

## Common Issues

### "Redirect URI mismatch"
- **Cause**: The redirect URL in your code doesn't match what's in Supabase
- **Fix**: Add the exact URL to Supabase redirect URLs list

### "Connection refused" on localhost
- **Cause**: You're testing production but Supabase redirects to localhost
- **Fix**: Make sure `NEXT_PUBLIC_BASE_URL` is set correctly in production

### "Invalid code" error
- **Cause**: The code has expired or was already used
- **Fix**: Try logging in again

## Debug Checklist

- [ ] Supabase redirect URLs include both localhost and production
- [ ] `NEXT_PUBLIC_BASE_URL` is set in production environment
- [ ] Google OAuth is enabled in Supabase
- [ ] Google Cloud Console has Supabase callback URL configured
- [ ] The `/auth/callback` route exists and is accessible
- [ ] Middleware doesn't block `/auth/callback` route

