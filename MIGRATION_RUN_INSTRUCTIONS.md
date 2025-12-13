# Database Migration Instructions

## Files to Run (In Order)

Run these 4 SQL migration files in the Supabase SQL Editor, **one at a time**, in this exact order:

### 1. `frontend/migrations/create_call_logs.sql`
   - Creates the `call_logs` table
   - Stores call recordings, transcripts, summaries
   - **File path:** `frontend/migrations/create_call_logs.sql`

### 2. `frontend/migrations/create_appointments.sql`
   - Creates the `appointments` table
   - Stores booked appointments with calendar sync
   - **File path:** `frontend/migrations/create_appointments.sql`

### 3. `frontend/migrations/create_call_retries.sql`
   - Creates the `call_retries` table
   - Tracks retry attempts for unanswered calls
   - **File path:** `frontend/migrations/create_call_retries.sql`

### 4. `frontend/migrations/update_agents_table.sql`
   - Updates the existing `agents` table
   - Adds email, calendar sync, language preferences
   - **File path:** `frontend/migrations/update_agents_table.sql`

---

## How to Run

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query** button

3. **For Each File:**
   - Open the migration file (e.g., `frontend/migrations/create_call_logs.sql`)
   - Copy **ALL** the contents
   - Paste into the SQL Editor
   - Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`)
   - Wait for "Success. No rows returned" message
   - **Then move to the next file**

4. **Verify Success**
   - After running all 4 files, verify tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('call_logs', 'appointments', 'call_retries');
   ```
   - You should see all 3 tables listed

---

## Important Notes

- ✅ **Run in order** - The files depend on each other (foreign keys)
- ✅ **Idempotent** - Safe to run multiple times (uses `IF NOT EXISTS`)
- ✅ **RLS Enabled** - All tables have Row Level Security policies
- ✅ **No Data Loss** - These are new tables/columns, won't affect existing data

---

## Troubleshooting

**Error: "relation already exists"**
- The table already exists, which is fine
- The migration uses `IF NOT EXISTS`, so it's safe to rerun

**Error: "column already exists"**
- The column already exists in `agents` table
- The migration uses `IF NOT EXISTS`, so it's safe to rerun

**Error: "permission denied"**
- Make sure you're using the SQL Editor (has full permissions)
- Or run as a database superuser

---

## After Running Migrations

Once all 4 migrations are complete:
1. ✅ Tables are created and ready
2. ✅ RLS policies are active
3. ✅ You can start using the Call History feature
4. ✅ Vapi webhook can start storing call data


