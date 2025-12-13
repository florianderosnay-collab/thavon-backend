# Support Tickets Setup Guide

## What You're Doing
You're creating a database table to store support tickets that customers submit through the support page.

## Step-by-Step Instructions

### Step 1: Open Supabase
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (the one you're using for Thavon)

### Step 2: Open the SQL Editor
1. In the left sidebar, click on **"SQL Editor"** (it has a database icon)
2. You'll see a big text box where you can type SQL code

### Step 3: Copy the SQL Code
1. Open the file: `frontend/migrations/create_support_tickets.sql`
2. Select ALL the text in that file (Ctrl+A or Cmd+A)
3. Copy it (Ctrl+C or Cmd+C)

### Step 4: Paste into Supabase
1. Click inside the SQL Editor text box in Supabase
2. Delete anything that's already there (if you see `create_support_tickets.sql`, delete it)
3. Paste the code you copied (Ctrl+V or Cmd+V)

### Step 5: Run the Code
1. Look for a button that says **"Run"** or **"Execute"** (usually at the bottom right or top right)
2. Click it
3. Wait a few seconds

### Step 6: Check for Success
- ✅ **Success**: You'll see a green checkmark or "Success" message
- ❌ **Error**: If you see red text, copy the error message and let me know

## What This Does
This creates a table called `support_tickets` that will store:
- Customer name and email
- The issue they're reporting
- Priority level (low, medium, high, critical)
- Status (open, in progress, resolved, etc.)

## Troubleshooting

### Error: "function update_updated_at_column() does not exist"
If you get this error, run this code FIRST in the SQL Editor:

```sql
-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Then run the main migration again.

### Error: "relation agencies does not exist"
This means the `agencies` table doesn't exist yet. You need to create that first. Let me know and I'll help you with that.

## Need More Help?
If you're still stuck, tell me:
1. What step are you on?
2. What error message do you see (if any)?
3. Can you take a screenshot of what you see in Supabase?


