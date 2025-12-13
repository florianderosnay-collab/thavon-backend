# Vapi Webhook Configuration Guide

## Critical Distinction: Server URL vs Webhook URL

Vapi uses **TWO different URLs** for different purposes:

### 1. Server URL (Already Configured ✅)
- **Location**: Railway backend
- **URL**: `https://web-production-274e.up.railway.app/assistant-request`
- **Purpose**: Dynamic assistant configuration during calls
- **Events**: `assistant-request` only
- **Configuration**: In Vapi Dashboard → Phone Numbers → Edit → Server URL

### 2. Webhook URL (MUST CONFIGURE ⚠️)
- **Location**: Vercel frontend
- **URL**: `https://app.thavon.io/api/webhooks/vapi`
- **Purpose**: Receive call completion data (recordings, transcripts, summaries)
- **Events**: 
  - `end-of-call-report` (critical - contains full call data)
  - `status-update`
  - `function-call`
  - `transcript-update`
  - etc.
- **Configuration**: In Vapi Dashboard → Settings → Webhooks → Add Webhook

---

## Configuration Steps

### Step 1: Configure Server URL (Already Done)
✅ This is already set to: `https://web-production-274e.up.railway.app/assistant-request`

### Step 2: Configure Webhook URL (ACTION REQUIRED)

1. Go to Vapi Dashboard: https://dashboard.vapi.ai
2. Navigate to **Settings** → **Webhooks**
3. Click **Add Webhook** or **Configure Webhook**
4. Enter the webhook URL: `https://app.thavon.io/api/webhooks/vapi`
5. Select the following events:
   - ✅ `end-of-call-report` (CRITICAL)
   - ✅ `status-update`
   - ✅ `function-call`
   - ✅ `transcript-update`
   - ✅ All other available events
6. Save the configuration

---

## Why This Matters

### Current Issue:
- Events (`speech-update`, `conversation-update`) are being sent to the Server URL
- But the `end-of-call-report` (with full call data) is NOT being sent
- This is because the Webhook URL is not configured in Vapi

### Once Fixed:
- `end-of-call-report` will be sent to `https://app.thavon.io/api/webhooks/vapi`
- Frontend webhook will receive full call data (recording URL, transcript, summary, duration)
- Call logs will be saved to Supabase
- Dashboard will update with call counts
- Call History page will show recordings and transcripts
- Notifications will be sent

---

## Testing

After configuring the webhook URL:
1. Make a test call from the dashboard
2. Wait for the call to complete
3. Check Railway logs for: `📤 Forwarding end-of-call-report event to frontend webhook`
4. Check Vercel logs for: `📞 Vapi Webhook: end-of-call-report`
5. Verify dashboard updates
6. Verify call appears in Call History with recording/transcript

---

## Current Architecture

```
Call Initiated
    ↓
Vapi receives call request
    ↓
Vapi makes assistant-request → Server URL (Railway)
    ↓                            ↓
Call happens              Dynamic config returned
    ↓
Call completes
    ↓
Vapi sends end-of-call-report → Webhook URL (Vercel)
                                     ↓
                          Frontend saves to Supabase
                                     ↓
                          Dashboard updates
```

---

## Environment Variables to Verify

### Railway (Backend)
- `VAPI_API_KEY` or `VAPI_PUBLIC_KEY` ✅
- `VAPI_PHONE_NUMBER_ID` ✅
- `NEXT_PUBLIC_BASE_URL` = `https://app.thavon.io` ✅

### Vercel (Frontend)
- `NEXT_PUBLIC_BASE_URL` = `https://app.thavon.io` ✅
- `VAPI_WEBHOOK_SECRET` (optional, for signature verification)

---

## Next Steps

1. **Configure the webhook URL in Vapi Dashboard** (see Step 2 above)
2. Test a call
3. Verify `end-of-call-report` is received
4. Confirm dashboard and call logs update

This is the final piece to complete the integration.

