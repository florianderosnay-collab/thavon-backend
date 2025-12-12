# Integrations Setup Guide

This guide explains how to set up the integrations system for Thavon.

## Database Setup

1. Run the SQL migration to create the `agency_integrations` table:

```sql
-- See: frontend/migrations/create_agency_integrations.sql
```

Run this in your Supabase SQL editor or via migration tool.

## Environment Variables

Add these to your `.env.local` or Vercel environment:

### OAuth Providers

**HubSpot:**
```
HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
```

**Salesforce:**
```
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
```

### Webhook Security (Optional)
```
WEBHOOK_SECRET=your_webhook_secret_key
```

### Base URL
```
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## OAuth App Setup

### HubSpot

1. Go to HubSpot Settings > Integrations > Private Apps
2. Create a new private app
3. Add scopes: `contacts`, `crm.objects.contacts.read`, `crm.objects.contacts.write`
4. Copy Client ID and Client Secret
5. Set redirect URI: `https://your-domain.com/api/integrations/callback/hubspot`

### Salesforce

1. Go to Salesforce Setup > App Manager > New Connected App
2. Enable OAuth Settings
3. Add scopes: `api`, `refresh_token`, `offline_access`
4. Set callback URL: `https://your-domain.com/api/integrations/callback/salesforce`
5. Copy Consumer Key (Client ID) and Consumer Secret

## Security Notes

⚠️ **Important:** 
- OAuth tokens are stored in plain text in the database. In production, encrypt them using Supabase Vault or a similar service.
- The `agency_integrations` table uses RLS (Row Level Security) to ensure agencies can only access their own integrations.
- Webhook signatures can be validated using the `WEBHOOK_SECRET` environment variable.

## Testing

1. Start your development server
2. Navigate to `/integrations`
3. Click "Connect" on any integration
4. For OAuth providers, you'll be redirected to authorize
5. After authorization, you'll be redirected back with the connection established

## API Endpoints

- `POST /api/integrations/connect` - Initiate OAuth flow or mark webhook as ready
- `GET /api/integrations/callback/[provider]` - OAuth callback handler
- `GET /api/integrations/status?agencyId=xxx` - Get connection status for all integrations
- `POST /api/integrations/disconnect` - Disconnect an integration
- `POST /api/integrations/test` - Test an active connection

## Next Steps

1. Implement token refresh logic for expired OAuth tokens
2. Add encryption for stored credentials
3. Implement actual data sync (importing leads, pushing call results)
4. Add webhook signature validation for each provider
5. Create sync jobs to periodically pull leads from connected CRMs

