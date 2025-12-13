# Vapi Integration - Complete Setup & Fixes

## 🎯 Summary of All Changes

### Problem
- Calls were working, but dashboard/call logs weren't updating
- No recordings, transcripts, or notifications
- Events were being sent but not processed

### Root Causes Identified & Fixed
1. ❌ **Missing metadata in Vapi calls** → ✅ Added `agency_id` and `lead_id` to all calls
2. ❌ **Wrong webhook URL** → ✅ Fixed to use `app.thavon.io`
3. ❌ **Event routing logic** → ✅ Updated to check both `payload.type` and `message.type`
4. ❌ **Webhook URL not configured in Vapi Dashboard** → ⚠️ **YOU MUST CONFIGURE THIS**

---

## 🔧 Code Changes Made

### 1. main.py (Railway Backend)

#### Added Metadata to Outbound Calls (Line ~755)
```python
vapi_payload = {
    "phoneNumberId": phone_number_id,
    "customer": { "number": str(lead_phone), "name": lead_name },
    "assistant": { ... },
    "metadata": {  # ← NEW: Required for webhook processing
        "agency_id": str(agency_id),
        "lead_id": str(lead_id) if lead_id else None,
        "is_inbound": False
    }
}
```

#### Added Metadata to Inbound Calls (Line ~950)
```python
call_payload = {
    "phoneNumberId": os.environ.get("VAPI_PHONE_NUMBER_ID"),
    "customer": { "number": str(phone), "name": name },
    "assistant": { ... },
    "metadata": {  # ← NEW: Required for webhook processing
        "agency_id": str(agency_id),
        "lead_id": str(lead_id) if lead_id else None,
        "is_inbound": True
    }
}
```

#### Fixed Webhook URL (Line ~1207)
```python
webhook_url = os.environ.get('NEXT_PUBLIC_BASE_URL', 'https://app.thavon.io')
webhook_url = webhook_url.rstrip('/')  # Remove trailing slash
if 'thavon.vercel.app' in webhook_url:
    webhook_url = 'https://app.thavon.io'  # Force correct domain
frontend_webhook = f"{webhook_url}/api/webhooks/vapi"
```

#### Fixed Event Routing (Line ~1040)
```python
# Check both event_type and message_type (Vapi sends type in different locations)
should_forward = (event_type in webhook_events) or (message_type in webhook_events)
```

### 2. frontend/app/api/webhooks/vapi/route.ts (Vercel Frontend)

#### Fixed Event Type Detection (Line ~81)
```typescript
// Vapi sends type in message.type for Server URL events
const message = payload.message || {};
const eventType = message.type || payload.type || payload.event;
```

#### Fixed Call Data Extraction (Line ~246)
```typescript
// Check both message.call and payload.call
const call = message.call || payload.call || payload;
const metadata = call.metadata || message.call?.metadata || call.customData || payload.metadata || {};
```

#### Added Fallback Lookups (Line ~275)
```typescript
// FALLBACK 1: Look up by vapi_call_id
if (!agencyId && callId) {
  const { data: existingCall } = await supabaseAdmin
    .from("call_logs")
    .select("agency_id, lead_id")
    .eq("vapi_call_id", callId)
    .single();
  if (existingCall) {
    agencyId = existingCall.agency_id;
  }
}

// FALLBACK 2: Look up by phone number
if (!agencyId) {
  const phoneNumber = call.customer?.number || call.phoneNumber;
  if (phoneNumber) {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("agency_id, id")
      .eq("phone_number", phoneNumber)
      .single();
    if (lead) {
      agencyId = lead.agency_id;
    }
  }
}
```

---

## ⚠️ CRITICAL ACTION REQUIRED

### Configure Vapi Webhook URL

**You MUST do this in the Vapi Dashboard:**

1. Go to: https://dashboard.vapi.ai
2. Click: **Settings** → **Webhooks**
3. Add webhook: `https://app.thavon.io/api/webhooks/vapi`
4. Enable events:
   - `end-of-call-report` ✅ (CRITICAL)
   - `status-update` ✅
   - `function-call` ✅
   - All others ✅

**Without this configuration:**
- `end-of-call-report` will NOT be sent
- Call logs will NOT be created
- Dashboard will NOT update
- No recordings/transcripts

**With this configuration:**
- Full call data is sent to your frontend
- Call logs are saved automatically
- Dashboard updates in real-time
- Recordings and transcripts are stored

---

## 📊 Expected Behavior After Fix

### During Call:
1. User clicks "START HUNTING"
2. Railway initiates Vapi call with metadata
3. Vapi sends `assistant-request` to Railway → Dynamic config returned
4. Call happens
5. Events forwarded: `assistant.started`, `speech-update`, `conversation-update`

### After Call:
6. Vapi sends `end-of-call-report` to `https://app.thavon.io/api/webhooks/vapi`
7. Frontend webhook processes event:
   - Extracts `agency_id` from metadata (or fallback lookup)
   - Saves call log to Supabase
   - Updates lead status to "called"
   - Sends notifications (if configured)
8. Dashboard updates:
   - Call count increments
   - Recent activity shows new call
9. Call History page shows:
   - Call recording
   - Transcript
   - Summary
   - Duration

---

## 🧪 Testing Checklist

After configuring the webhook URL:

- [ ] Make a test call from dashboard
- [ ] Wait for call to complete fully
- [ ] Check Railway logs for: `📤 Forwarding end-of-call-report`
- [ ] Check Vercel logs for: `📞 Vapi Webhook: end-of-call-report`
- [ ] Verify dashboard "Total Calls" increments
- [ ] Verify call appears in "Recent Activity"
- [ ] Navigate to Call History page
- [ ] Verify call appears with:
  - [ ] Recording URL (playable audio)
  - [ ] Full transcript
  - [ ] Summary
  - [ ] Correct status
  - [ ] Duration
- [ ] Verify notifications sent (if configured):
  - [ ] Email notification
  - [ ] WhatsApp notification (if configured)

---

## 🔍 Debugging

If still not working:

### Check Railway Logs
Look for:
- `✅ Call initiated: [call_id]`
- `📤 Forwarding end-of-call-report event to frontend webhook`
- `✅ Successfully forwarded end-of-call-report to frontend`

### Check Vercel Logs
Look for:
- `📞 Vapi Webhook: end-of-call-report`
- No errors about missing `agency_id`

### Check Supabase
Query: `SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 10;`
- Should show recent calls with recordings and transcripts

### Check Vapi Dashboard
- Go to Calls → Recent Calls
- Find your call
- Check if webhook was sent
- Look for any errors

---

## 📝 Files Modified

1. `main.py` - Added metadata to calls, fixed webhook URL, improved event routing
2. `frontend/app/api/webhooks/vapi/route.ts` - Fixed event parsing, added fallback lookups
3. `VAPI_WEBHOOK_CONFIGURATION_GUIDE.md` - This guide
4. `VAPI_INTEGRATION_COMPLETE.md` - This summary

---

## 🎉 Once Complete

Your Thavon app will have:
- ✅ AI voice calls working
- ✅ Real-time dashboard metrics
- ✅ Call recordings stored
- ✅ Transcripts available
- ✅ Call history tracking
- ✅ Agent notifications
- ✅ Complete audit trail

All you need to do is **configure the webhook URL in Vapi Dashboard**.


