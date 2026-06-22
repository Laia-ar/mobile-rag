#!/bin/bash

#set -x 
QUESTION=$@

[ -z "$QUESTION" ] && echo missing question && exit 1

MODEL=all-MiniLM-L6-v2-ggml-model-f16.gguf
DATABASE=./itsrag_2026-06-17_175741.db

#MODEL=embeddinggemma-300m-Q4_0.gguf
#MODEL=android/app/src/main/assets/knowledge.current/all-MiniLM-L6-v2
#DATABASE=android/app/src/main/assets/knowledge.current/corpus.sqlite

MATRYOSHKA_256='.[:256] as $t | ($t | map(. * .) | add | sqrt) as $norm | $t | map(. / $norm)'

VECTOR=$(llama-embedding -m "$MODEL" -ngl 99 -p "$QUESTION" --embd-output-format "json" 2>/dev/null | jq -c .data[0].embedding | jq -c "$MATRYOSHKA_256")

THRESHOLD=0.01

# https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm
# https://en.wikipedia.org/wiki/Full-text_search
# https://sqlite.org/fts5.html
# https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html

# convert question into full text search filter
# 1) remove bad chars: double quote, start, open close parentesis
# 2) remove white space and replace with quote at the end
# 3) remove white space and replace with quote at the begining
# 4) split sentence in words and concatenate with OR
FTS_FILTER=$(echo $QUESTION | sed 's/["\*\(\)]//g;s/ *$/"/;s/^ */"/;s/  */" OR "/g')

QUERY="
.param set :query_emb '$VECTOR'
.param set :query_str '$FTS_FILTER'
.param set :threshold $THRESHOLD
.param set :corpus '4a767b76-1cba-4568-b4d9-f649fd6ccf0c'
.param set :k 30
.param set :rrf_k 60
.param set :weight_fts 1.0
.param set :weight_vec 1.0

with vec_matches as (
  select
    c.id as chunk_id,
    v.distance score
  from chunks_vec as v
  join chunks as c on c.rowid = v.rowid
  where
    v.embedding match (:query_emb)
    and v.k = :k
    and v.corpus_id = :corpus
  order by v.distance
),
fts_matches as (
  select
    chunk_id,
    text_for_display,
    bm25(chunks_fts) AS score
  from chunks_fts
  where chunks_fts match (:query_str)
    and corpus_id = :corpus
  order by score
  limit :k
),
final as (
  select
    documents.title,
    chunks.content,
    fts_matches.text_for_display as text,
    vec_matches.score as vec_rank,
    fts_matches.score as fts_rank,
    (
      coalesce(1.0 / (:rrf_k + fts_matches.score), 0.0) * :weight_fts +
      coalesce(1.0 / (:rrf_k + vec_matches.score), 0.0) * :weight_vec
    ) as combined_rank
  from fts_matches
  full outer join vec_matches on vec_matches.chunk_id = fts_matches.chunk_id
  join chunks on chunks.id = coalesce(fts_matches.chunk_id, vec_matches.chunk_id)
  join documents on documents.id = chunks.document_id
  order by combined_rank desc
)
select * from final where combined_rank > :threshold limit 5;
"

DOCS=$(echo "$QUERY"      | sqlite3 -readonly -cmd ".load $SQLITE/dist/vec0.so" $DATABASE -json)

echo $DOCS | jq '.[] | "Documento: \(.combined_rank) \(.title) \n==============\n\(.content)\n============"' -r
