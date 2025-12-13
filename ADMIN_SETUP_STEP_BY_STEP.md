# Admin Setup - Step by Step Guide

Follow these steps **exactly** to set yourself up as an admin.

## Step 1: Delete Existing Admin Entry

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste this SQL:

```sql
-- Delete any existing admin entry for your email
DELETE FROM admin_users WHERE email = 'florianderosnay@gmail.com';
```

6. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
7. You should see: `Success. No rows returned` or similar

✅ **Step 1 Complete** - Your old admin entry is deleted.

---

## Step 2: Find Your Actual User ID

1. In Supabase Dashboard, go to **Authentication** → **Users** (left sidebar)
2. Find your account: `florianderosnay@gmail.com`
3. Click on your user row to open the details
4. **Copy the User UID** - it looks like: `123e4567-e89b-12d3-a456-426614174000`
5. **IMPORTANT**: Write it down or keep it copied - you'll need it in Step 3

✅ **Step 2 Complete** - You have your User ID.

---

## Step 3: Add Yourself as Admin

1. Go back to **SQL Editor** in Supabase
2. Click **New Query**
3. Copy and paste this SQL (replace `YOUR_USER_ID_HERE` with the User UID from Step 2):

```sql
-- Add yourself as admin
INSERT INTO admin_users (user_id, email, is_active)
VALUES (
  'YOUR_USER_ID_HERE',  -- Paste your User UID here
  'florianderosnay@gmail.com',
  true
);
```

4. **Replace `YOUR_USER_ID_HERE`** with your actual User UID from Step 2
5. Click **Run**
6. You should see: `Success. 1 row inserted.`

✅ **Step 3 Complete** - You're now an admin!

---

## Step 4: Verify the Entry

1. In Supabase Dashboard, go to **Table Editor** (left sidebar)
2. Find and click on the `admin_users` table
3. You should see your entry with:
   - Your email: `florianderosnay@gmail.com`
   - Your user_id: (the UUID you copied)
   - is_active: `true` (should be a checkbox, checked)

✅ **Step 4 Complete** - Entry verified.

---

## Step 5: Test Admin Access

1. Make sure you're **logged in** at `https://app.thavon.io`
2. Navigate to: `https://app.thavon.io/admin/support`
3. You should see the **Admin Support Dashboard** (not "Access Denied")

✅ **Step 5 Complete** - Admin access working!

---

## Troubleshooting

### If you still see "Access Denied":

1. **Check the user_id matches:**
   - Go to Supabase → Authentication → Users
   - Copy your User UID again
   - Go to Table Editor → `admin_users`
   - Verify the `user_id` in the table matches exactly

2. **Check is_active is true:**
   - In `admin_users` table, make sure `is_active` is checked/true
   - If it's a string `'true'`, run this:
   ```sql
   UPDATE admin_users 
   SET is_active = true 
   WHERE email = 'florianderosnay@gmail.com';
   ```

3. **Try logging out and back in:**
   - Log out from `app.thavon.io`
   - Log back in with Google
   - Try accessing `/admin/support` again

4. **Check browser console:**
   - Open Developer Console (F12)
   - Look for any error messages
   - Check the Network tab for failed requests

---

## Quick Reference

**Your Email**: `florianderosnay@gmail.com`

**Table**: `admin_users`

**Required Fields**:
- `user_id` (UUID) - Must match your User UID from Authentication → Users
- `email` (TEXT) - `florianderosnay@gmail.com`
- `is_active` (BOOLEAN) - Must be `true`

**Admin URL**: `https://app.thavon.io/admin/support`


