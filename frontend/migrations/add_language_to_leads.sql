-- Add language preference column to leads table for multi-language support
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- Add index for language queries (optional, but helpful)
CREATE INDEX IF NOT EXISTS idx_leads_preferred_language ON leads(preferred_language) WHERE preferred_language IS NOT NULL;

-- Add comment
COMMENT ON COLUMN leads.preferred_language IS 'ISO 639-1 language code (e.g., en, fr, de, es) for multi-language call support';


