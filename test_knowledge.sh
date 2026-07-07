#!/bin/bash

#set -x 
QUESTION=$@

[ -z "$QUESTION" ] && echo missing question && exit 1

ASSETS=android/app/src/main/assets/knowledge.current

MODEL=$ASSETS/all-MiniLM-L6-v2-ggml-model-f16.gguf
DATABASE=$ASSETS/corpus.sqlite

#MODEL=$ASSETS/embeddinggemma-300m-Q4_0.gguf
#MODEL=$ASSETS/all-MiniLM-L6-v2
#DATABASE=$ASSETS/corpus.sqlite

# all-MiniLM-L6-v2 genera vectores de 384 dimensiones; no se normaliza a 256.
VECTOR=$(llama-embedding -m "$MODEL" -ngl 99 -p "$QUESTION" --embd-output-format "json" 2>/dev/null | jq -c .data[0].embedding)

TOPK=5
THRESHOLD=0.0

QUERY="
.param set :query_emb '$VECTOR'
.param set :topk $TOPK
.param set :threshold $THRESHOLD

SELECT
  chunk_id,
  document_id,
  content,
  metadata,
  vec_distance_cosine(embedding, vec_f32(:query_emb)) AS distance
FROM vec_chunks
ORDER BY distance
LIMIT :topk;
"

DOCS=$(echo "$QUERY" | sqlite3 -readonly -cmd ".load $SQLITE/dist/vec0.so" "$DATABASE" -json)

echo "$DOCS" | jq .
echo "$DOCS" | jq -r '.[] | "Documento: \(.document_id) (distancia \(.distance))\n==============\n\(.content)\n============"'
