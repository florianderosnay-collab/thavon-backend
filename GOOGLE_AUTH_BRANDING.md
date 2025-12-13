# Change Google OAuth "to continue to" Text

## Quick Fix: Show "thavon.io" Instead of Supabase URL

The "to continue to" text in the Google OAuth screen is controlled by the **Authorized Domains** in Google Cloud Console.

## Steps to Change It

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com
- Select your project: **Thavon**

### 2. Navigate to OAuth Consent Screen
- Go to: **APIs & Services** → **OAuth consent screen**
- Or direct link: https://console.cloud.google.com/apis/credentials/consent

### 3. Add Authorized Domain
1. Scroll down to the **"Authorized domains"** section
2. Click **"+ Add domain"** button
3. Enter: `thavon.io`
4. Click **Add**

### 4. Update Application Information (Optional but Recommended)
While you're there, update:
- **Application home page**: `https://thavon.io`
- **Application name**: `Thavon` (or your preferred name)
- **Application privacy policy link**: `https://thavon.io/privacy` (if you have one)
- **Application Terms of Service link**: `https://thavon.io/terms` (if you have one)

### 5. Save Changes
- Click **Save and Continue** at the bottom
- The changes may take a few minutes to propagate

## Result

After adding `thavon.io` as an authorized domain, the Google OAuth screen will show:
- **Before**: "to continue to neaquwkenojpdcbdgoau.supabase.co"
- **After**: "to continue to thavon.io"

## Important Notes

⚠️ **Domain Verification**: 
- Google may require you to verify ownership of `thavon.io`
- You'll need to add a DNS TXT record or HTML file to verify ownership
- Follow Google's verification instructions if prompted

⚠️ **Domain Must Match**:
- The domain you add must match your actual website domain
- If your site is at `app.thavon.io`, make sure that's what you add
- Or set up a custom domain in Vercel to use `thavon.io`

## Alternative: Use Application Name

If you can't verify the domain, you can also:
1. Set a clear **Application name** (e.g., "Thavon")
2. The screen will show "to continue to Thavon" instead of the domain

## Testing

1. After making changes, wait 5-10 minutes for Google to update
2. Try logging in with Google again
3. You should see "to continue to thavon.io" (or your app name)

