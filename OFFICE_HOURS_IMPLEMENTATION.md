# Office Hours Implementation Guide

## Overview
The inbound webhook now respects office hours (8:00 AM - 9:00 PM) based on each agency's timezone.

## Features Implemented

### 1. Timezone Support
- Default timezone: `Europe/Luxembourg` (UTC+1)
- Agencies can have their own timezone stored in the `agencies` table
- Uses Python's `zoneinfo` (Python 3.9+) or `backports.zoneinfo` for older versions

### 2. Office Hours Check
- **Office Hours:** 8:00 AM (08:00) to 9:00 PM (21:00)
- Checks current time in agency's timezone
- Logs office hours status for debugging

### 3. Inbound Webhook Behavior

**Inside Office Hours:**
- Saves lead with status: `calling_inbound`
- Triggers Vapi call after 30-second delay
- Returns: `{"status": "calling", "lead": name, "message": "Call will be initiated in 30 seconds"}`

**Outside Office Hours:**
- Saves lead with status: `queued_night`
- Does NOT trigger call
- Returns: `{"status": "queued", "lead": name, "message": "Lead saved and queued for next business day"}`

### 4. Start Campaign Endpoint Updates

The `/start-campaign` endpoint now:
- **Prioritizes** `queued_night` leads (from outside office hours)
- Processes `queued_night` leads first
- Then processes `new` leads if slots remain
- Updates `queued_night` leads to `new` status when processing
- Returns count of queued vs new leads processed

## Database Schema

### Agencies Table
You may want to add a `timezone` column to the `agencies` table:

```sql
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Luxembourg';
```

If the column doesn't exist, the system defaults to `Europe/Luxembourg`.

## Testing

### Test Inside Office Hours
1. Ensure current time is between 8:00 AM and 9:00 PM in agency's timezone
2. Send webhook to `/webhooks/inbound/{agency_id}`
3. Should receive: `{"status": "calling", ...}`
4. Lead should be saved with status: `calling_inbound`

### Test Outside Office Hours
1. Ensure current time is before 8:00 AM or after 9:00 PM in agency's timezone
2. Send webhook to `/webhooks/inbound/{agency_id}`
3. Should receive: `{"status": "queued", ...}`
4. Lead should be saved with status: `queued_night`

### Test Start Campaign
1. Create some `queued_night` leads (outside office hours)
2. Create some `new` leads
3. Call `/start-campaign` with agency_id
4. Should process `queued_night` leads first, then `new` leads
5. `queued_night` leads should be updated to `new` status

## Configuration

### Setting Agency Timezone
Update the agency's timezone in Supabase:

```sql
UPDATE agencies 
SET timezone = 'America/New_York' 
WHERE id = 'your-agency-id';
```

### Supported Timezones
Any valid IANA timezone identifier:
- `Europe/Luxembourg` (default)
- `America/New_York`
- `America/Los_Angeles`
- `Europe/London`
- `Asia/Tokyo`
- etc.

## Code Changes

### New Functions
- `get_agency_timezone(agency_id)` - Fetches agency timezone from database
- `is_within_office_hours(agency_id)` - Checks if current time is within office hours

### Modified Endpoints
- `/webhooks/inbound/{agency_id}` - Now checks office hours before calling
- `/start-campaign` - Now processes `queued_night` leads with priority

## Dependencies
- `backports.zoneinfo` (for Python < 3.9) - Added to `requirements.txt`
- `zoneinfo` (built-in for Python 3.9+)

## Notes
- If timezone check fails, defaults to allowing calls (fail-open for reliability)
- Office hours are hardcoded to 8:00 AM - 9:00 PM (can be made configurable later)
- The 30-second delay before calling is implemented for all calls within office hours

