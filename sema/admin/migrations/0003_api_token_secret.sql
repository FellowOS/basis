-- Persist API token plaintext for admin re-copy (auth still uses token_hash).
ALTER TABLE api_tokens ADD COLUMN token_secret TEXT;
