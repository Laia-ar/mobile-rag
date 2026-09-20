#!/bin/bash
# Corre la prueba on-device para todos los modelos, uno atrás del otro.
# Resultados en /home/didi/code/mobile-rag/results/<model_id>/
# Log maestro: results/loop.log
set -u

MR=/home/didi/code/mobile-rag
ITS=/home/didi/code/its-rag
GGUF_DIR=$ITS/models/gguf
VARIANTS=$ITS/drafts/mobile-rag-package/out/variants
SRC_PKG=$ITS/drafts/mobile-rag-package/out/qwen3-4b   # base v1.1.0 (db+docs+embeddings idénticos)
ASSETS=$MR/android/app/src/main/assets
RESULTS=$MR/results
mkdir -p "$RESULTS" "$VARIANTS"

export JAVA_HOME=/home/didi/code/mobile-rag/.jdk/jdk-17.0.20.1+1
export ANDROID_HOME=/home/didi/code/mobile-rag/.android-sdk
export PATH="$JAVA_HOME/bin:$PATH"

# id|archivo_gguf — los dos últimos se descargan al inicio del loop
MODELS="
llama-3.2-1b|Llama-3.2-1B-Instruct-Q4_K_M.gguf
lfm2-2.6b|LFM2-2.6B-Q4_K_M.gguf
smollm3-3b|SmolLM3-Q4_K_M.gguf
phi-4-mini|Phi-4-mini-instruct-Q4_K_M.gguf
jan-v1-4b|Jan-v1-4B-Q4_K_M.gguf
qwen3-4b-instruct|Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf
medgemma-4b|medgemma-4b-it-Q4_K_M.gguf
gemma-3-4b|google_gemma-3-4b-it-Q4_K_M.gguf
qwen3.5-4b|Qwen3.5-4B-Q4_K_M.gguf
qwen3.8-4b|Qwen3.8-4B-Q4_K_M.gguf
qwen3.5-2b|Qwen_Qwen3.5-2B-Q4_K_M.gguf
gemma-4-e2b|google_gemma-4-E2B-it-Q4_K_M.gguf
"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$RESULTS/loop.log"; }

for line in $MODELS; do
  ID="${line%%|*}"
  GGUF="${line##*|}"
  log "===== $ID ($GGUF) ====="

  if [ ! -f "$GGUF_DIR/$GGUF" ]; then
    log "SKIP $ID: falta $GGUF"
    continue
  fi
  if [ -f "$RESULTS/$ID/q2.txt" ] || [ -f "$RESULTS/$ID/q1.txt" ]; then
    log "SKIP $ID: ya tiene resultados"
    continue
  fi

  log "$ID: variante"
  python3 "$ITS/drafts/mobile-rag-package/make_variant.py" \
    --src "$SRC_PKG" --dst "$VARIANTS/$ID" \
    --gguf "$GGUF_DIR/$GGUF" --llm-id "$ID" >> "$RESULTS/loop.log" 2>&1 || { log "FAIL $ID: make_variant"; continue; }

  log "$ID: swap assets"
  rm -rf "$ASSETS/knowledge.current"
  cp -r "$VARIANTS/$ID" "$ASSETS/knowledge.current"

  log "$ID: build"
  if ! (cd "$MR" && ./build-release.sh >> "$RESULTS/loop.log" 2>&1); then
    log "FAIL $ID: build"; continue
  fi

  log "$ID: install"
  if ! timeout 420 adb install -r "$MR/android/app/build/outputs/apk/prod/release/app-prod-release.apk" >> "$RESULTS/loop.log" 2>&1; then
    log "FAIL $ID: install"; continue
  fi

  log "$ID: test on-device"
  chmod +x "$MR/run_model_test.sh"
  timeout 1500 "$MR/run_model_test.sh" "$ID" > "$RESULTS/$ID.run.log" 2>&1
  rc=$?
  mkdir -p "$RESULTS/$ID"
  cp "$RESULTS/$ID.run.log" "$RESULTS/$ID/run.log"
  if [ $rc = 0 ]; then log "OK $ID"; else log "FAIL $ID: test rc=$rc"; fi

done

# dejar el device con la build recomendada (llama-3.2-3b)
log "===== restore llama-3.2-3b ====="
rm -rf "$ASSETS/knowledge.current"
cp -r "$ITS/drafts/mobile-rag-package/out/llama32-3b" "$ASSETS/knowledge.current"
(cd "$MR" && ./build-release.sh >> "$RESULTS/loop.log" 2>&1) && \
  timeout 420 adb install -r "$MR/android/app/build/outputs/apk/prod/release/app-prod-release.apk" >> "$RESULTS/loop.log" 2>&1
log "===== LOOP COMPLETO ====="
