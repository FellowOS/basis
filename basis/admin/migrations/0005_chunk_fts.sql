-- Rebuildable full-text projection for canonical chunks.
-- trigram supports substring matching and unsegmented CJK text for queries
-- containing at least three Unicode code points.

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    chunk_id UNINDEXED,
    kb_id UNINDEXED,
    text,
    tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS chunks_fts_insert
AFTER INSERT ON chunks
BEGIN
    INSERT INTO chunks_fts(chunk_id, kb_id, text)
    VALUES (new.id, new.kb_id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_update
AFTER UPDATE OF text, kb_id ON chunks
BEGIN
    DELETE FROM chunks_fts WHERE chunk_id = old.id;
    INSERT INTO chunks_fts(chunk_id, kb_id, text)
    VALUES (new.id, new.kb_id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_fts_delete
AFTER DELETE ON chunks
BEGIN
    DELETE FROM chunks_fts WHERE chunk_id = old.id;
END;

INSERT INTO chunks_fts(chunk_id, kb_id, text)
SELECT c.id, c.kb_id, c.text
FROM chunks c
WHERE NOT EXISTS (
    SELECT 1 FROM chunks_fts f WHERE f.chunk_id = c.id
);

CREATE INDEX IF NOT EXISTS chunks_kb_created
    ON chunks(kb_id, created_at DESC);
