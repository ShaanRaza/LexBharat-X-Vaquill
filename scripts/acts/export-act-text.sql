-- Writes every Central and State/UT legislation chunk as newline-delimited JSON, grouped by act (ordered by act_id, chunk_id).
-- Regulator instruments are NOT read (excluded from W1a). Placeholders __DIR__ and __TMP__ are replaced by export-act-text.sh.
COPY (
  SELECT act_id AS actId, title, jurisdiction, state, act_status AS actStatus, CAST(year AS INTEGER) AS year, source_url AS sourceUrl,
         chunk_id AS chunkId, section_number AS sectionNumber, text
  FROM read_parquet('__DIR__/in_*_legislation.parquet')
  ORDER BY act_id, chunk_id
) TO '__TMP__' (FORMAT JSON, ARRAY false);
