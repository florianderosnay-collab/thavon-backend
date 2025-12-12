# Database Migration Instructions

## Quick Start

### 1. Run the Migration SQL

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query** button

3. **Copy the Migration File**
   - Open: `frontend/migrations/create_agency_integrations.sql`
   - Copy **ALL** the contents (lines 1-59)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click **Run** button (or press `Cmd+Enter` / `Ctrl+Enter`)

5. **Verify Success**
   - You should see: "Success. No rows returned"
   - The table was created successfully!

### 2. Verify the Table

Run this query to confirm:

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'agency_integrations'
ORDER BY ordinal_position;
```

You should see all the columns listed.

---

## What This Migration Creates

The `agency_integrations` table stores:
- ✅ OAuth access tokens (encrypted)
- ✅ OAuth refresh tokens (encrypted)
- ✅ API keys (encrypted)
- ✅ Integration status and metadata
- ✅ Last sync timestamps

**Security Features:**
- Row Level Security (RLS) enabled
- Agencies can only see their own integrations
- Service role has full access (for API routes)

---

## Troubleshooting

**Error: "relation already exists"**
- The table already exists. You can either:
  - Drop it first: `DROP TABLE IF EXISTS agency_integrations CASCADE;`
  - Or skip this migration if you already have the table

**Error: "permission denied"**
- Make sure you're using the SQL Editor (has full permissions)
- Or run as a database superuser

**Error: "column already exists"**
- The table exists but has different columns
- Check existing columns first, then modify the migration if needed

---

## Next Steps

After running the migration:
1. ✅ Set up your encryption key (see `SETUP_ENCRYPTION.md`)
2. ✅ Configure OAuth apps (HubSpot, Salesforce)
3. ✅ Test connecting an integration
4. ✅ Test syncing leads

