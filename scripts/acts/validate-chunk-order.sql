-- Chunk-ordering validation for legislation section text (read-only; writes nothing). Run via scripts/acts/validate-chunk-order.sh.
-- Question: can split section rows be put back in reading order from chunk_id alone? Only the `_p<N>` family (section split into parts) is tested here.
-- Method: for adjacent parts N and N+1 of the same section, compare the paragraph-start sub-section markers "\n( _k_ )": the first marker of part N+1 must be
-- greater than the last marker of part N. Only pairs where BOTH parts contain such a marker are testable. This is a proxy, not ground truth.
WITH c AS (
  SELECT act_id, regexp_extract(chunk_id,'^(.*)_p([0-9]+)$',1) fam, try_cast(regexp_extract(chunk_id,'_p([0-9]+)$',1) AS INT) p,
    list_transform(regexp_extract_all(text, '\n\( _([0-9]+)_ \)', 1), lambda x: try_cast(x AS INT)) mk
  FROM read_parquet('__DIR__/in_*_legislation.parquet') WHERE regexp_matches(chunk_id,'_p[0-9]+$')
), pairs AS (SELECT a.mk mka, b.mk mkb FROM c a JOIN c b ON a.fam=b.fam AND b.p=a.p+1),
scored AS (SELECT len(mka)>0 AND len(mkb)>0 AS comparable, (len(mka)>0 AND len(mkb)>0 AND mkb[1] > mka[len(mka)]) AS in_order FROM pairs)
SELECT count(*) AS adjacent_pairs, count(*) FILTER (comparable) AS testable_pairs, count(*) FILTER (in_order) AS in_order,
  round(100.0*count(*) FILTER (in_order)/nullif(count(*) FILTER (comparable),0),2) AS pct_in_order,
  round(100.0*count(*) FILTER (comparable)/count(*),1) AS pct_testable FROM scored;
-- Integrity of the _p sequences: families should run 0..n-1 with no gaps or duplicates.
WITH c AS (SELECT regexp_extract(chunk_id,'^(.*)_p([0-9]+)$',1) fam, try_cast(regexp_extract(chunk_id,'_p([0-9]+)$',1) AS INT) p FROM read_parquet('__DIR__/in_*_legislation.parquet') WHERE regexp_matches(chunk_id,'_p[0-9]+$'))
SELECT count(*) AS part_families, count(*) FILTER (mn<>0) AS not_starting_at_0, count(*) FILTER (mx+1<>n) AS gaps_or_duplicates FROM (SELECT fam, min(p) mn, max(p) mx, count(*) n FROM c GROUP BY fam);
-- Other suffix families seen in chunk_id, by share of rows (these are NOT validated: _d<N>, _<N>, bare).
WITH t AS (SELECT regexp_replace(chunk_id, '^.*?_(s|b)', '\1') suffix FROM read_parquet('__DIR__/in_*_legislation.parquet'))
SELECT regexp_replace(regexp_replace(suffix,'[0-9]+','N','g'),'[A-Z]+$','X') AS pattern, count(*) AS n FROM t GROUP BY 1 ORDER BY 2 DESC LIMIT 12;
