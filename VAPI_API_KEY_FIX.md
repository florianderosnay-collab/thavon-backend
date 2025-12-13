# Vapi API Key Authentication Fix

## Problem
Getting `401 - Invalid Key` error from Vapi API. The error message says:
> "Invalid Key. Hot tip, you may be using the private key instead of the public key, or vice versa."

## Root Cause
The `VAPI_API_KEY` environment variable in Railway is either:
1. **Not set** - Missing environment variable
2. **Wrong key type** - Using public key instead of private key (or vice versa)
3. **Invalid/expired** - Key is no longer valid
4. **Wrong format** - Key might need a prefix or different format

## Solution

### Step 1: Get the Correct Vapi API Key

1. **Log into Vapi Dashboard**
   - Go to https://dashboard.vapi.ai
   - Sign in to your account

2. **Find Your API Keys**
   - Navigate to **Settings** → **API Keys** (or similar)
   - You should see two types of keys:
     - **Private Key** (for server-side API calls) ← **USE THIS ONE**
     - **Public Key** (for client-side calls)

3. **Copy the Private Key**
   - The private key should look like: `sk_...` or similar
   - Copy the entire key

### Step 2: Update Railway Environment Variable

1. **Go to Railway Dashboard**
   - Navigate to your backend service
   - Click on **Variables** tab

2. **Set/Update `VAPI_API_KEY`**
   - Find `VAPI_API_KEY` in the list
   - If it exists, click **Edit**
   - If it doesn't exist, click **New Variable**
   - **Paste your Vapi Private Key**
   - Click **Save**

3. **Verify `VAPI_PHONE_NUMBER_ID` is also set**
   - This should be your Vapi Phone Number ID (not the API key)
   - Found in Vapi Dashboard → Phone Numbers

### Step 3: Redeploy

After updating environment variables:
- Railway should auto-redeploy
- Or manually trigger a redeploy

### Step 4: Test

1. Go to dashboard
2. Click "START HUNTING"
3. Check Railway logs - should see `200` or `201` instead of `401`

## Common Issues

**Issue:** Still getting 401 after updating key
- **Solution:** Make sure you're using the **Private Key**, not the Public Key
- Double-check there are no extra spaces or newlines in the key

**Issue:** Key looks correct but still fails
- **Solution:** Regenerate the key in Vapi dashboard and update Railway

**Issue:** Don't see API Keys in Vapi dashboard
- **Solution:** Check Vapi documentation or contact Vapi support for where to find API keys

## Verification

After fixing, the logs should show:
- `✅ Call initiated: <call_id>` instead of `❌ Vapi API Error: 401`

---

**Note:** The code now makes real API calls (not mocked), so the key must be valid for calls to work.

