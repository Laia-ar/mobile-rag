#!/bin/bash

QUESTION=$@

[ -z "$QUESTION" ] && echo missing question && exit 1

VECTORS=$(llama-embedding -m android/app/src/main/assets/knowledge.current/all-MiniLM-L6-v2 -ngl 99 -p "$QUESTION" --embd-output-format "json" 2>/dev/null | jq .data[0].embedding -c)

# https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm
# https://en.wikipedia.org/wiki/Full-text_search
# https://sqlite.org/fts5.html
# https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html

QUERY="
.param set :query '$QUESTION'
.param set :k 20
.param set :rrf_k 60
.param set :weight_fts 1.0
.param set :weight_vec 1.0

-- the sqlite-vec KNN vector search results
with vec_matches as (
  select
    article_id,
    row_number() over (order by distance) as rank_number,
    distance
  from vec_articles
  where
    headline_embedding match lembed(:query)
    and k = :k
),
-- the FTS5 search results
fts_matches as (
  select
    rowid,
    row_number() over (order by rank) as rank_number,
    rank as score
  from fts_articles
  where headline match :query
  limit :k
),
-- combine FTS5 + vector search results with RRF
final as (
  select
    articles.id,
    articles.headline,
    vec_matches.rank_number as vec_rank,
    fts_matches.rank_number as fts_rank,
    -- RRF algorithm
    (
      coalesce(1.0 / (:rrf_k + fts_matches.rank_number), 0.0) * :weight_fts +
      coalesce(1.0 / (:rrf_k + vec_matches.rank_number), 0.0) * :weight_vec
    ) as combined_rank,
    vec_matches.distance as vec_distance,
    fts_matches.score as fts_score
  from fts_matches
  full outer join vec_matches on vec_matches.article_id = fts_matches.rowid
  join articles on articles.rowid = coalesce(fts_matches.rowid, vec_matches.article_id)
  order by combined_rank desc
)
select * from final;
"

DOCS=$(echo $QUERY      | sqlite3 -readonly -cmd ".load $SQLITE/dist/vec0.so" android/app/src/main/assets/knowledge.current/corpus.sqlite -json)

echo $DOCS | jq '.[] | "Documento: \(.document_id) \(.distance)\n==============\n\(.content)\n============"' -r
