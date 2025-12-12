# Encryption Key & Migration Setup Guide

## 🔐 Setting the Encryption Key

The encryption key is used to encrypt OAuth tokens and API keys before storing them in the database. You need to set it in **two places**:

### 1. **Frontend (Next.js) - For Local Development**

Create a file called `.env.local` in the `frontend/` directory:

```bash
cd frontend
touch .env.local
```

Add this line to `.env.local`:

```env
ENCRYPTION_KEY=your-32-character-or-longer-secret-key-here
```

**Generate a secure key:**
```bash
# Option 1: Using OpenSSL (recommended)
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example:**
```env
ENCRYPTION_KEY=K8x9mN2pQ5rT7vW0yZ3aB6cD8eF1gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4c
```

### 2. **Frontend (Vercel) - For Production**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** (paste your generated key)
   - **Environment:** Production, Preview, Development (check all)

### 3. **Backend (Railway) - If Needed**

If your backend also needs to decrypt tokens, add it to Railway:

1. Go to your Railway project
2. Navigate to **Variables** tab
3. Add:
   - **Key:** `ENCRYPTION_KEY`
   - **Value:** (same key as above - **must match!**)

⚠️ **Important:** Use the **SAME encryption key** in all environments (frontend and backend) so tokens can be decrypted properly.

### Fallback Behavior

If `ENCRYPTION_KEY` is not set, the system will fall back to using `SUPABASE_SERVICE_ROLE_KEY` for encryption. This works but is **not recommended for production** as it's less secure.

---

## 📊 Running the Database Migration

The migration creates the `agency_integrations` table to store encrypted OAuth tokens.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Copy and Run the Migration

1. Open the file: `frontend/migrations/create_agency_integrations.sql`
2. Copy **ALL** the SQL code (lines 1-59)
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

### Step 3: Verify the Table Was Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'agency_integrations';
```

You should see `agency_integrations` in the results.

### What the Migration Does

- ✅ Creates `agency_integrations` table
- ✅ Sets up indexes for fast lookups
- ✅ Enables Row Level Security (RLS)
- ✅ Creates policies so agencies can only see their own integrations
- ✅ Adds auto-update trigger for `updated_at` timestamp

---

## ✅ Quick Checklist

- [ ] Generated a secure encryption key (32+ characters)
- [ ] Added `ENCRYPTION_KEY` to `frontend/.env.local` (for local dev)
- [ ] Added `ENCRYPTION_KEY` to Vercel environment variables (for production)
- [ ] Ran the SQL migration in Supabase SQL Editor
- [ ] Verified the table was created successfully

---

## 🧪 Testing

After setup, test the encryption:

1. Connect an integration (e.g., HubSpot)
2. Check the database - tokens should be encrypted (long base64 strings)
3. Try syncing leads - it should decrypt and work correctly

If you see errors about decryption, double-check that `ENCRYPTION_KEY` is set correctly in all environments.

