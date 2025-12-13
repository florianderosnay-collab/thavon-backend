# Vapi Key Type Fix - Public vs Private Key

## Problem
Getting `401 - Invalid Key` error with message:
> "Invalid Key. Hot tip, you may be using the private key instead of the public key, or vice versa."

## Root Cause
Vapi uses **two different types of keys**:
- **Private/Secret Key**: For account management and dashboard access
- **Public Key**: For making phone calls via the API

If you're using the wrong key type, you'll get a 401 error even if the key is valid.

## Solution

The code now **automatically tries both key types** if available:

1. **First tries `VAPI_PUBLIC_KEY`** (if set)
2. **Then tries `VAPI_API_KEY`** (if different from public key)
3. **Falls back to `VAPI_Private_Key`** if neither is available

### Option 1: Set Both Keys in Railway (Recommended)

1. Go to Railway → Your Backend Service → Variables
2. Set **both** environment variables:
   - `VAPI_PUBLIC_KEY` = Your Vapi **Public Key** (for API calls)
   - `VAPI_API_KEY` = Your Vapi **Private Key** (for account management, optional)

The code will automatically try the public key first, which should work for API calls.

### Option 2: Use Only Public Key

1. Go to Railway → Your Backend Service → Variables
2. Set:
   - `VAPI_PUBLIC_KEY` = Your Vapi **Public Key**
   - (Remove or leave `VAPI_API_KEY` empty)

### Option 3: Test Which Key Works

1. In Railway, temporarily rename `VAPI_API_KEY` to `VAPI_API_KEY_OLD`
2. Add a new variable `VAPI_PUBLIC_KEY` with your Vapi Public Key
3. Redeploy
4. Test - if it works, the issue was the key type
5. If it still fails, try the Private Key in `VAPI_PUBLIC_KEY` instead

## How to Find Your Keys in Vapi Dashboard

1. Go to https://dashboard.vapi.ai
2. Navigate to **Settings** → **API Keys**
3. You should see:
   - **Public Key** (usually starts with `pk_` or similar)
   - **Private/Secret Key** (usually starts with `sk_` or similar)

**For API calls, you typically need the Public Key.**

## Verification

After setting the keys, check the logs:
- Look for `"key_type": "VAPI_PUBLIC_KEY"` in the logs
- If you see `"401 with VAPI_API_KEY, trying next key"`, it means the first key failed and it's trying the next one
- Success will show `"status_code": 200` or `201`

## What Changed in the Code

The code now:
1. Checks for both `VAPI_PUBLIC_KEY` and `VAPI_API_KEY` environment variables
2. Tries the public key first (if available)
3. Falls back to the API key if public key fails with 401
4. Logs which key type is being used
5. Logs when it retries with a different key

This ensures the correct key type is used automatically.

