#!/usr/bin/env bash
set -euo pipefail

COUNTRY="${1:-}"
case "$COUNTRY" in
  AR|BO) shift ;;
  *) echo "Uso: ./test_knowledge.sh AR|BO 'pregunta'" >&2; exit 1 ;;
esac
QUESTION="$*"
[ -n "$QUESTION" ] || { echo "Uso: ./test_knowledge.sh AR|BO 'pregunta'" >&2; exit 1; }
: "${SQLITE_VEC_EXTENSION:?Definí SQLITE_VEC_EXTENSION con la ruta a vec0}"

ASSETS="android/app/src/main/assets/knowledge.current"
MANIFEST="$ASSETS/manifest.json"
[ -f "$MANIFEST" ] || { echo "Falta $MANIFEST" >&2; exit 1; }

CORPUS_ID=$(jq -er --arg country "$COUNTRY" '.corpus.countryIds[$country]' "$MANIFEST")
DATABASE="$ASSETS/$(jq -er '.corpus.databasePath' "$MANIFEST")"
MODEL="$ASSETS/$(jq -er '.embedding.modelPath' "$MANIFEST")"
DIMENSIONS=$(jq -er '.embedding.retrievalDimensions' "$MANIFEST")
QUERY_PREFIX=$(jq -er '.embedding.queryPrefix // ""' "$MANIFEST")

[ -f "$DATABASE" ] || { echo "Falta $DATABASE" >&2; exit 1; }
[ -f "$MODEL" ] || { echo "Falta $MODEL" >&2; exit 1; }

RAW_VECTOR=$(
  llama-embedding -m "$MODEL" -p "$QUERY_PREFIX$QUESTION" \
    --embd-output-format json 2>/dev/null |
    jq -c '.data[0].embedding'
)
VECTOR=$(
  jq -cn --argjson vector "$RAW_VECTOR" --argjson dims "$DIMENSIONS" '
    ($vector[:$dims]) as $truncated |
    ($truncated | map(. * .) | add | sqrt) as $norm |
    $truncated | map(. / $norm)
  '
)
FTS_FILTER=$(printf '%s' "$QUESTION" |
  sed 's/["*()]//g; s/  */ /g; s/^ */"/; s/ *$/"/; s/ /" OR "/g')

sqlite3 -readonly -json \
  -cmd ".load $SQLITE_VEC_EXTENSION" \
  -cmd ".parameter init" \
  -cmd ".parameter set :query_emb '$VECTOR'" \
  -cmd ".parameter set :query_str '$FTS_FILTER'" \
  -cmd ".parameter set :corpus '$CORPUS_ID'" \
  "$DATABASE" <<'SQL' | jq .
WITH vec_matches AS (
  SELECT c.id AS chunk_id,
         ROW_NUMBER() OVER (ORDER BY v.distance) AS rank
  FROM chunks_vec v
  JOIN chunks c ON c.rowid = v.rowid
  WHERE v.embedding MATCH :query_emb
    AND v.k = 30
    AND v.corpus_id = :corpus
),
fts_matches AS (
  SELECT chunk_id,
         ROW_NUMBER() OVER (ORDER BY bm25(chunks_fts)) AS rank
  FROM chunks_fts
  WHERE chunks_fts MATCH :query_str
    AND corpus_id = :corpus
  ORDER BY bm25(chunks_fts)
  LIMIT 30
),
ranked AS (
  SELECT chunk_id, 1.0 / (60 + rank) AS score FROM vec_matches
  UNION ALL
  SELECT chunk_id, 1.0 / (60 + rank) AS score FROM fts_matches
),
scores AS (
  SELECT chunk_id, SUM(score) AS similarity
  FROM ranked
  GROUP BY chunk_id
)
SELECT c.id AS chunk_id,
       d.title,
       c.page,
       c.content,
       scores.similarity
FROM scores
JOIN chunks c ON c.id = scores.chunk_id
JOIN documents d ON d.id = c.document_id
ORDER BY scores.similarity DESC
LIMIT 5;
SQL
