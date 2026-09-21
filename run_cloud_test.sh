#!/bin/bash
# Uso: PKG=ar.laia.palmera.cloud QUESTIONS_JSON=/tmp/qs.json ./run_cloud_test.sh <run_id>
# Variante cloud de run_topk_test.sh: la respuesta no llega por stream de llama.cpp
# sino por fetch a OpenRouter; se espera y extrae desde el dump de UI.
set -u
MODEL_ID="$1"
PKG="${PKG:-ar.laia.palmera.cloud}"
QUESTIONS_JSON="${QUESTIONS_JSON:-/tmp/cloud_test_questions.json}"
TMP=/tmp/ui_dump_cloud.xml
RES=/home/didi/code/mobile-rag/results/$MODEL_ID
mkdir -p "$RES"

dump() { # valida: si uiautomator falla (app ocupada), NO dejar contenido viejo en $TMP
  local i
  for i in 1 2 3; do
    if adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; then
      adb shell cat /sdcard/ui.xml > $TMP
      grep -q "<hierarchy" $TMP && return 0
    fi
    sleep 2
  done
  : > $TMP
  return 1
}

tap_cd() {
  local needle="$1" bounds
  dump
  bounds=$(python3 - "$needle" $TMP <<'EOF'
import re, sys
needle, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for m in re.finditer(r'<node[^>]*>', xml):
    tag = m.group(0)
    cd = re.search(r'content-desc="([^"]*)"', tag)
    tx = re.search(r'text="([^"]*)"', tag)
    hit = (cd and cd.group(1) == needle) or (tx and tx.group(1) == needle)
    if hit and 'clickable="true"' in tag:
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if b:
            x1,y1,x2,y2 = map(int, b.groups())
            print(f"{(x1+x2)//2} {(y1+y2)//2}")
            break
EOF
)
  [ -n "$bounds" ] && adb shell input tap $bounds && return 0
  return 1
}

has_cd() { dump; grep -qE "(content-desc|text)=\"$1\"" $TMP; }

type_in_edittext() {
  local bounds
  dump
  bounds=$(python3 - $TMP <<'EOF'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
for m in re.finditer(r'<node[^>]*class="android.widget.EditText"[^>]*>', xml):
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', m.group(0))
    if b:
        x1,y1,x2,y2 = map(int, b.groups())
        print(f"{(x1+x2)//2} {(y1+y2)//2}")
        break
EOF
)
  [ -z "$bounds" ] && return 1
  adb shell input tap $bounds; sleep 1
  adb shell input text "'${1// /%s}'"; sleep 1
  adb shell input keyevent 111; sleep 2
}

tap_send() {
  local send
  dump
  send=$(python3 - $TMP <<'EOF'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
for m in re.finditer(r'<node[^>]*class="android.widget.Button"[^>]*>', xml):
    tag = m.group(0)
    cd = re.search(r'content-desc="([^"]*)"', tag)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if b and (not cd or cd.group(1) == ''):
        x1,y1,x2,y2 = map(int, b.groups())
        if x1 > 900:
            print(f"{(x1+x2)//2} {(y1+y2)//2}")
            break
EOF
)
  [ -n "$send" ] && adb shell input tap $send && return 0
  return 1
}

extract_answer() { # $1 = pregunta (para excluirla); imprime respuesta + fuentes
  python3 - $TMP "$1" <<'EOF'
import re, sys
path, question = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
texts = re.findall(r'text="([^"]*)"', xml)
texts = [t.replace('&amp;','&').replace('&lt;','<').replace('&gt;','>').replace('&#10;','\n') for t in texts]
qstart = question[:40]
cands = [t for t in texts if len(t) > 100 and not t.startswith(qstart)
         and not t.startswith('Las respuestas se generan')]
ans = cands[-1] if cands else ''
fuentes = next((t for t in texts if re.match(r'Ver \d+ fuentes', t)), '')
print(f"[{fuentes}]")
print(ans)
EOF
}

ask() { # $1=pregunta $2=tag
  local Q="$1" TAG="$2" last="" stable=0 t=0 ans prev=""
  # respuesta visible ANTES de mandar: la nueva debe ser distinta (evita off-by-one)
  # línea 2 = respuesta (la 1 es "[fuentes]"); si está vacía command-substitution la
  # traga y tail -1 devolvería la línea de fuentes -> falso positivo. Usar sed -n 2p.
  dump || true
  prev=$(extract_answer "$Q" | sed -n '2p')
  type_in_edittext "$Q" || { echo "FAIL_TYPE $TAG"; return 1; }
  tap_send || { echo "FAIL_SEND $TAG"; return 1; }
  local t0=$SECONDS
  while [ $t -lt 240 ]; do
    sleep 5; t=$((t+5))
    if [ -z "$(adb shell pidof $PKG 2>/dev/null)" ]; then echo "CRASH"; return 2; fi
    # refrescar el dump ANTES de extraer: sin esto $TMP queda congelado al
    # momento del send y la "estabilidad" es ficticia (off-by-one)
    dump || { stable=0; continue; }
    ans=$(extract_answer "$Q")
    local cur
    cur=$(echo "$ans" | sed -n '2p')
    if [ -n "$cur" ] && [ "$cur" != "$prev" ] && [ "$ans" = "$last" ]; then
      stable=$((stable+1)); [ $stable -ge 2 ] && break
    else stable=0; fi
    last="$ans"
  done
  { echo "pregunta: $Q"; echo "latencia_s: $((SECONDS-t0))"; echo "$last"; } > "$RES/$TAG.txt"
  adb exec-out screencap -p > "$RES/$TAG.png" 2>/dev/null
  echo "$TAG listo ($((SECONDS-t0))s)"
}

# ---- flujo principal ----
echo "== unlock + launch ($PKG) =="
adb shell svc power stayon true 2>/dev/null
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0
adb shell input keyevent KEYCODE_WAKEUP; adb shell input keyevent 82
adb shell am force-stop $PKG; sleep 1
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 8
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 0
sleep 2

for attempt in 1 2 3; do
  if has_cd "Chatbot, Consulta directa al RAG"; then break; fi
  if has_cd "Bolivia"; then tap_cd "Bolivia"; sleep 1; tap_cd "Continuar"; sleep 2; fi
  if has_cd "Siguiente"; then tap_cd "Siguiente"; sleep 2; fi
  if has_cd "Finalizar"; then tap_cd "Finalizar"; sleep 2; fi
  if has_cd "Ingresar"; then
    type_in_edittext "0001"
    tap_cd "Ingresar"; sleep 4
    has_cd "Ingresar" && { adb shell input tap 540 1842; sleep 4; }
  fi
  if has_cd "Aceptar y continuar"; then tap_cd "Aceptar y continuar"; sleep 4; fi
done
if ! has_cd "Chatbot, Consulta directa al RAG"; then
  echo "FAIL_ONBOARDING"; adb exec-out screencap -p > "$RES/fail_onboarding.png"
  exit 1
fi

echo "== abrir chat =="
tap_cd "Chatbot, Consulta directa al RAG"; sleep 10
has_cd "Escriba aquí su consulta" || { sleep 10; has_cd "Escriba aquí su consulta" || { echo "FAIL_CHAT"; adb exec-out screencap -p > "$RES/fail_chat.png"; exit 1; }; }

N=$(python3 -c "import json; print(len(json.load(open('$QUESTIONS_JSON'))))")
for i in $(seq 0 $((N-1))); do
  Q=$(python3 -c "import json; print(json.load(open('$QUESTIONS_JSON'))[$i]['pregunta'])")
  TAG="q$((i+1))"
  if [ -z "$(adb shell pidof $PKG 2>/dev/null)" ]; then echo "CRASH antes de $TAG — fin"; break; fi
  echo "== $TAG =="
  ask "$Q" "$TAG" || echo "$TAG status: $?"
  sleep 3
done
echo "== fin $MODEL_ID =="
