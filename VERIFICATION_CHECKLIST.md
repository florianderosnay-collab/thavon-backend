# Complete Verification Checklist

## All Fixes Deployed

Run through this checklist to verify everything is working:

---

## 1. Check Supabase Database

Run this SQL in Supabase SQL Editor:

```sql
-- Check call_logs
SELECT 
  id,
  vapi_call_id,
  agency_id,
  status,
  duration_seconds,
  recording_url IS NOT NULL as has_recording,
  LENGTH(transcript) as transcript_length,
  created_at
FROM call_logs 
ORDER BY created_at DESC 
LIMIT 3;

-- Check if UNIQUE constraint exists
SELECT 
  conname as constraint_name
FROM pg_constraint 
WHERE conrelid = 'call_logs'::regclass
  AND conname = 'call_logs_vapi_call_id_unique';
```

**Expected:**
- ✅ You should see recent calls
- ✅ You should see the constraint name

**If constraint is missing:**
- Run the migration SQL I provided earlier

---

## 2. Check Vercel Runtime Logs

1. Go to Vercel Dashboard → Logs → Runtime Logs
2. Filter: `/api/webhooks/vapi`
3. Look for the MOST RECENT call

**Expected to see:**
```
🔍 RAW PAYLOAD: { messageType: 'end-of-call-report' }
📞 Vapi Webhook: end-of-call-report { callId: '...' }
✅ Processing call update { hasRecording: true/false }
✅ Call log saved successfully
```

**If you see errors:**
- Share the error message
- Check if the constraint was added

---

## 3. Check Dashboard Metrics API

1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh dashboard page
4. Find request to `/api/dashboard/metrics`
5. Check the response

**Expected:**
```json
{
  "totalLeads": X,
  "callsAttempted": 2 (or more),
  "appointments": X,
  ...
}
```

**If callsAttempted is 0:**
- Check Vercel logs for `/api/dashboard/metrics`
- Look for console.log: `📊 Dashboard Metrics:`
- Share the output

---

## 4. Check Recent Activity API

1. In DevTools Network tab
2. Find request to `/api/dashboard/activity`
3. Check the response

**Expected:**
```json
{
  "activities": [
    { "title": "Call completed", ... },
    ...
  ],
  "count": X
}
```

**If activities is empty:**
- Check Vercel logs for `/api/dashboard/activity`
- Look for: `📊 Recent Activity:`
- Share the output

---

## 5. Test New Call with ALL Features

Make a test call and:
1. Answer the phone when Thavon calls
2. Have a conversation
3. Say: "Yes, I'd like to schedule a viewing for tomorrow at 2pm"
4. Let the call complete naturally
5. Wait 30 seconds

**Then check:**
- [ ] Dashboard "Calls Attempted" increments
- [ ] Recent Activity shows the call
- [ ] Call History shows the call
- [ ] Click on the call → Should show:
  - [ ] Recording (play button)
  - [ ] Transcript (text)
  - [ ] Summary
  - [ ] Duration
- [ ] Appointments tab shows the appointment

---

## 6. If Still Not Working

Share these from Vercel:
1. Latest runtime logs for `/api/webhooks/vapi` (the end-of-call-report event)
2. Latest runtime logs for `/api/dashboard/metrics`
3. Latest runtime logs for `/api/dashboard/activity`
4. Screenshot of Supabase SQL results

---

## Common Issues & Solutions

### Issue: Dashboard shows 0 calls
**Cause**: Admin client not configured or RLS blocking
**Fix**: Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars

### Issue: No recording/transcript
**Cause**: Vapi recording not enabled or call too short
**Fix**: Check Vapi dashboard → Settings → Recording enabled

### Issue: No appointment created
**Cause**: AI didn't call the function or function-call event not handled
**Fix**: Verify Vercel logs show `function-call` event being received

### Issue: Recent Activity empty
**Cause**: Call logs not linked to leads properly
**Fix**: Check if `lead_id` is populated in call_logs table

---

## Success Criteria

✅ Dashboard metrics show live data  
✅ Recent Activity shows calls  
✅ Call History shows calls with recording/transcript  
✅ Appointments are created when mentioned  
✅ Dashboard updates automatically every 30s  
✅ No errors in Vercel logs  

Once all criteria are met, remove debug instrumentation.

