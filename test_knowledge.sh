#!/bin/bash

QUESTION=$@

[ -z "$QUESTION" ] && echo missing question && exit 1

VECTORS=$(llama-embedding -m android/app/src/main/assets/knowledge.current/all-MiniLM-L6-v2 -ngl 99 -p "$QUESTION" --embd-output-format "json" 2>/dev/null | jq .data[0].embedding -c)

QUERY="select chunk_id, distance, document_id, content from vec_chunks where embedding match ${VECTORS@Q} order by distance limit 3;"

DOCS=$(echo $QUERY | sqlite3 -readonly -cmd ".load $SQLITE/dist/vec0.so" android/app/src/main/assets/knowledge.current/corpus.sqlite -json)

echo $DOCS | jq '.[] | "Documento: \(.document_id) \(.distance)\n==============\n\(.content)\n============"' -r
