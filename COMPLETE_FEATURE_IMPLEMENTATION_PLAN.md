# Complete Feature Implementation Plan

**Date:** 2025-01-27  
**Goal:** Implement all missing features from www.thavon.io to make app.thavon.io complete

---

## 🏗️ Architecture Overview

### High-Ticket SaaS Logic:
1. **Agency Owner** → Sees ALL calls, manages team, full access
2. **Agent** → Sees only calls assigned to them, receives notifications
3. **Call Data** → Stored securely with RLS, accessible based on role
4. **Notifications** → Sent to both owner and assigned agent
5. **Calendar Sync** → Per-agent calendar integration

---

## 📋 Implementation Checklist

### Phase 1: Database Schema & Core Infrastructure

#### 1.1 Create `call_logs` Table
- Store call recordings, transcripts, summaries
- Link to leads and agents
- Track call status, duration, language
- **File:** `frontend/migrations/create_call_logs.sql`

#### 1.2 Create `appointments` Table
- Store booked appointments from calls
- Link to leads, agents, calendar events
- Track status (scheduled, completed, cancelled)
- **File:** `frontend/migrations/create_appointments.sql`

#### 1.3 Update `agents` Table (if needed)
- Add `email` field (for notifications)
- Add `google_calendar_id` (for calendar sync)
- Add `language_preference` (for multi-language)
- Add `notification_preferences` (JSONB)
- **File:** `frontend/migrations/update_agents_table.sql`

#### 1.4 Create `call_retries` Table
- Track retry attempts for unanswered calls
- Store retry schedule and max attempts
- **File:** `frontend/migrations/create_call_retries.sql`

---

### Phase 2: Vapi Webhook Handler

#### 2.1 Create Vapi Webhook Endpoint
- Receive call recordings, transcripts, summaries
- Store in `call_logs` table
- Assign to agents based on territory/availability
- Trigger notifications
- **File:** `frontend/app/api/webhooks/vapi/route.ts`

#### 2.2 Update Vapi Call Payloads
- Add `webhookUrl` to all Vapi calls
- Include `callMetadata` with lead_id, agency_id, agent_id
- **Files:** `main.py`, `frontend/app/api/webhooks/inbound/[agency_id]/route.ts`

---

### Phase 3: Call History & Recordings UI

#### 3.1 Create "Call History" Page
- List all calls with filters (date, status, agent, lead)
- Display call details (recording, transcript, summary)
- Download recordings
- Search transcripts
- **File:** `frontend/app/calls/page.tsx`

#### 3.2 Create Call Detail Modal/Page
- Full transcript view
- Audio player for recording
- Call summary and notes
- Lead information
- Agent assignment
- **File:** `frontend/app/calls/[call_id]/page.tsx` or modal component

#### 3.3 Add "Calls" to Sidebar Navigation
- Update `frontend/components/Sidebar.tsx`
- Add icon and route

---

### Phase 4: Email & WhatsApp Notifications

#### 4.1 Email Notifications (Resend)
- Call completed email (to owner + assigned agent)
- Include call summary, transcript link, recording link
- Appointment booked email
- **File:** `frontend/app/api/notifications/send-email/route.ts`

#### 4.2 WhatsApp Integration (Twilio)
- Send WhatsApp messages after calls
- Include call summary and recording link
- **File:** `frontend/app/api/notifications/send-whatsapp/route.ts`
- **Backend:** Add Twilio WhatsApp API to `main.py`

#### 4.3 Notification Preferences
- Allow agents to configure notification preferences
- Email only, WhatsApp only, or both
- **Update:** `frontend/app/team/page.tsx`

---

### Phase 5: Calendar Sync

#### 5.1 Google Calendar Integration
- OAuth flow for Google Calendar
- Store calendar credentials per agent
- **File:** `frontend/app/api/calendar/connect/route.ts`
- **File:** `frontend/app/api/calendar/callback/route.ts`

#### 5.2 Calendar Availability Check
- Check agent's calendar before booking
- Find available time slots
- **File:** `frontend/app/api/calendar/availability/route.ts`

#### 5.3 Create Calendar Events
- Create events when appointments are booked
- Sync with agent's Google Calendar
- **File:** `frontend/app/api/calendar/create-event/route.ts`

#### 5.4 Calendar UI
- Show agent's calendar sync status
- Allow connecting/disconnecting calendar
- **Update:** `frontend/app/team/page.tsx`

---

### Phase 6: Call Back / Retry Logic

#### 6.1 Track Unanswered Calls
- Mark calls as `no_answer` in `call_logs`
- Create entry in `call_retries` table
- **Update:** Vapi webhook handler

#### 6.2 Retry Scheduler
- Background job to check retry queue
- Retry after 2 hours, 24 hours (configurable)
- Max 3 retry attempts
- **File:** `main.py` (new function `process_call_retries`)

#### 6.3 Retry Configuration
- Allow agency to configure retry schedule
- **Update:** `frontend/app/settings/page.tsx`

---

### Phase 7: Multi-Language Support

#### 7.1 Language Detection
- Detect language from lead data or call
- Store in `leads` table: `preferred_language`
- **Update:** Lead import and inbound webhook

#### 7.2 Language Selection in Vapi
- Pass language to Vapi call payload
- Use Vapi's language support (100+ languages)
- **Update:** `main.py` and inbound webhook

#### 7.3 Language UI
- Allow setting default language per agency
- Language selector in lead import
- **Update:** `frontend/app/settings/page.tsx`, `frontend/app/leads/page.tsx`

---

### Phase 8: Agent Assignment & Permissions

#### 8.1 Agent Assignment Logic
- Assign calls to agents based on:
  - Territory (zip code matching)
  - Availability (calendar check)
  - Round-robin if no match
- **File:** `frontend/lib/agent-assignment.ts`

#### 8.2 Agent Permissions
- Agents can only see their own calls
- Owners see all calls
- RLS policies for `call_logs` table
- **Update:** Migration SQL

#### 8.3 Agent Dashboard
- Agents see their assigned calls
- Filter by status, date
- **File:** `frontend/app/agent/calls/page.tsx` (optional, or use same page with filters)

---

### Phase 9: Appointment Management

#### 9.1 Appointment List Page
- Show all appointments (owners) or assigned (agents)
- Filter by date, status, agent
- **File:** `frontend/app/appointments/page.tsx`

#### 9.2 Appointment Details
- View/edit appointment details
- Cancel/reschedule
- Send reminders
- **File:** `frontend/app/appointments/[id]/page.tsx`

#### 9.3 Appointment Reminders
- Email/SMS reminders 24h before appointment
- **File:** `frontend/app/api/appointments/send-reminder/route.ts`

---

## 🗂️ File Structure

```
frontend/
├── app/
│   ├── calls/
│   │   ├── page.tsx                    # Call history list
│   │   └── [call_id]/
│   │       └── page.tsx                 # Call detail page
│   ├── appointments/
│   │   ├── page.tsx                    # Appointments list
│   │   └── [id]/
│   │       └── page.tsx                 # Appointment detail
│   ├── agent/
│   │   └── calls/
│   │       └── page.tsx                # Agent's call view (optional)
│   └── api/
│       ├── webhooks/
│       │   └── vapi/
│       │       └── route.ts             # Vapi webhook handler
│       ├── notifications/
│       │   ├── send-email/
│       │   │   └── route.ts
│       │   └── send-whatsapp/
│       │       └── route.ts
│       ├── calendar/
│       │   ├── connect/
│       │   │   └── route.ts
│       │   ├── callback/
│       │   │   └── route.ts
│       │   ├── availability/
│       │   │   └── route.ts
│       │   └── create-event/
│       │       └── route.ts
│       └── appointments/
│           └── send-reminder/
│               └── route.ts
├── lib/
│   ├── agent-assignment.ts              # Agent assignment logic
│   ├── calendar.ts                     # Calendar helper functions
│   └── notifications.ts                # Notification helpers
├── migrations/
│   ├── create_call_logs.sql
│   ├── create_appointments.sql
│   ├── create_call_retries.sql
│   └── update_agents_table.sql
└── components/
    └── ui/
        ├── audio-player.tsx             # Audio player component
        └── transcript-viewer.tsx        # Transcript display component

main.py
└── (Updates to add Twilio WhatsApp, retry logic, language support)
```

---

## 🔐 Security & Permissions

### RLS Policies Needed:
1. **call_logs**: 
   - Owners: See all calls for their agency
   - Agents: See only calls assigned to them
2. **appointments**:
   - Same as call_logs
3. **agents**:
   - Owners: Full access to their agency's agents
   - Agents: Read-only access to their own record

---

## 📊 Database Schema Details

### `call_logs` Table:
```sql
- id (UUID, PK)
- agency_id (UUID, FK)
- lead_id (UUID, FK, nullable)
- agent_id (UUID, FK, nullable) -- Assigned agent
- vapi_call_id (TEXT) -- Vapi's call ID
- status (TEXT) -- 'completed', 'no_answer', 'busy', 'failed'
- duration_seconds (INTEGER)
- recording_url (TEXT) -- Vapi recording URL
- transcript (TEXT) -- Full transcript
- summary (TEXT) -- AI-generated summary
- language (TEXT) -- Language detected/used
- metadata (JSONB) -- Additional data
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### `appointments` Table:
```sql
- id (UUID, PK)
- agency_id (UUID, FK)
- lead_id (UUID, FK)
- agent_id (UUID, FK)
- call_id (UUID, FK, nullable) -- Link to call_logs
- scheduled_at (TIMESTAMPTZ)
- status (TEXT) -- 'scheduled', 'completed', 'cancelled', 'no_show'
- calendar_event_id (TEXT) -- Google Calendar event ID
- notes (TEXT)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### `call_retries` Table:
```sql
- id (UUID, PK)
- call_id (UUID, FK) -- Original call
- lead_id (UUID, FK)
- agency_id (UUID, FK)
- retry_count (INTEGER) -- 1, 2, 3
- scheduled_at (TIMESTAMPTZ) -- When to retry
- status (TEXT) -- 'pending', 'completed', 'failed', 'cancelled'
- created_at (TIMESTAMPTZ)
```

---

## 🚀 Implementation Order (Recommended)

1. **Week 1: Core Infrastructure**
   - Database migrations (call_logs, appointments, call_retries)
   - Vapi webhook handler
   - Basic call history page

2. **Week 2: Notifications & Calendar**
   - Email notifications
   - WhatsApp integration
   - Google Calendar OAuth
   - Calendar availability check

3. **Week 3: Advanced Features**
   - Call back/retry logic
   - Multi-language support
   - Agent assignment logic
   - Appointment management

4. **Week 4: Polish & Testing**
   - UI/UX improvements
   - Permissions & security
   - Testing & bug fixes
   - Documentation

---

## 💡 Quick Wins (Can Do First)

1. **Email Notifications** - Use existing Resend integration (2-3 hours)
2. **Call History Page** - Basic list view (4-6 hours)
3. **Vapi Webhook Handler** - Store call data (3-4 hours)
4. **Update Sidebar** - Add "Calls" menu item (15 minutes)

---

## 🔧 Environment Variables Needed

```env
# Twilio (for WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.thavon.io/api/calendar/callback

# Vapi (already have)
VAPI_API_KEY=
VAPI_PHONE_NUMBER_ID=

# Resend (already have)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

---

## 📝 Next Steps

1. Review this plan
2. Start with Phase 1 (Database migrations)
3. Implement Vapi webhook handler
4. Build call history page
5. Add notifications
6. Integrate calendar
7. Add remaining features

---

**Ready to start?** Let me know which phase you want to begin with, or I can start with the quick wins!


