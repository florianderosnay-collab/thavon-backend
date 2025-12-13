# Admin Dashboard Setup Guide

## Overview

The admin dashboard is now protected with authentication. Only users in the `admin_users` table can access `/admin/*` routes.

## Step 1: Run the Migration

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the file: `frontend/migrations/create_admin_users.sql`
5. Copy **ALL** the SQL code
6. Paste into the SQL Editor
7. Click **Run**
8. Wait for success message

## Step 2: Add Your First Admin User

After running the migration, you need to add yourself (or your admin users) to the `admin_users` table.

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this SQL (replace with your actual user email):

```sql
-- First, find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then insert yourself as admin (replace USER_ID_HERE with the ID from above)
INSERT INTO admin_users (user_id, email, is_active)
VALUES (
  'USER_ID_HERE',  -- Replace with your actual user ID
  'your-email@example.com',  -- Replace with your email
  true
);
```

### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → **Table Editor**
2. Find the `admin_users` table
3. Click **Insert** → **Insert row**
4. Fill in:
   - **user_id**: Your user ID from `auth.users` table
   - **email**: Your email address
   - **is_active**: `true`
5. Click **Save**

### How to Find Your User ID

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find your user account
3. Copy the **User UID** (it's a UUID like `123e4567-e89b-12d3-a456-426614174000`)
4. Use this as the `user_id` in the `admin_users` table

## Step 3: Test Admin Access

1. Make sure you're logged in with the account you added as admin
2. Navigate to: `https://app.thavon.io/admin/support`
3. You should see the admin dashboard
4. If you see "Access Denied", check:
   - Your user ID is correct in `admin_users` table
   - `is_active` is set to `true`
   - You're logged in with the correct account

## Adding More Admins

To add more admin users, repeat Step 2 with different user IDs and emails.

## Removing Admin Access

To remove admin access:

```sql
UPDATE admin_users 
SET is_active = false 
WHERE user_id = 'USER_ID_HERE';
```

Or delete the row entirely:

```sql
DELETE FROM admin_users 
WHERE user_id = 'USER_ID_HERE';
```

## Security Features

✅ **Middleware Protection**: `/admin/*` routes are protected at the middleware level
✅ **API Route Protection**: `/api/admin/*` routes check admin status
✅ **Frontend Protection**: Admin dashboard page checks admin status before loading
✅ **RLS Policies**: Database-level security with Row Level Security
✅ **Service Role Access**: API routes use service role for admin operations

## Troubleshooting

### "Access Denied" Error

**Possible causes:**
1. User not in `admin_users` table
2. `is_active` is set to `false`
3. Wrong `user_id` in the table
4. Not logged in with the correct account

**Fix:**
1. Check `admin_users` table in Supabase
2. Verify your user ID matches
3. Ensure `is_active = true`
4. Try logging out and back in

### Migration Error: "function is_admin does not exist"

**Fix:**
- The migration creates the `is_admin` function
- Make sure you ran the complete migration SQL
- The function is optional - the code has a fallback

### API Returns 403 Forbidden

**Fix:**
- Check that your user is in `admin_users` table
- Verify `is_active = true`
- Check browser console for error messages
- Try logging out and back in

## Quick Reference

**Table**: `admin_users`
**Required Fields**:
- `user_id` (UUID) - References `auth.users(id)`
- `email` (TEXT) - Admin's email
- `is_active` (BOOLEAN) - Must be `true` for access

**Protected Routes**:
- `/admin/*` - All admin pages
- `/api/admin/*` - All admin API endpoints

