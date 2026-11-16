#!/bin/bash
# Uso: ./onboard_and_test.sh "pregunta" [timeout_s]
# Onboarding (Bolivia / 0001) + chat + pregunta + espera por logcat.
set -u
QUESTION=${1:-"Cual es el esquema de primera linea de TARV en adultos?"}
RESP_TIMEOUT=${2:-600}
PKG="${PKG:-ar.laia.palmera.local}"
TMP=/tmp/ui_dump.xml

dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml > $TMP; }

tap_cd() { # tap por content-desc exacto
  dump
  local bounds
  bounds=$(python3 - "$1" $TMP <<'EOF'
import re, sys
needle, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for m in re.finditer(r'<node[^>]*>', xml):
    tag = m.group(0)
    cd = re.search(r'content-desc="([^"]*)"', tag)
    if cd and cd.group(1) == needle and 'clickable="true"' in tag:
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if b:
            x1,y1,x2,y2 = map(int, b.groups())
            print(f"{(x1+x2)//2} {(y1+y2)//2}")
            break
EOF
)
  if [ -n "$bounds" ]; then adb shell input tap $bounds; return 0; fi
  return 1
}

wait_cd() { # wait_cd <content-desc> <timeout_s>
  local elapsed=0
  while [ $elapsed -lt "$2" ]; do
    dump
    grep -q "content-desc=\"$1\"" $TMP && return 0
    sleep 2; elapsed=$((elapsed+2))
  done
  return 1
}

type_in_edittext() {
  dump
  local bounds
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
  adb shell input text "${1// /%s}"; sleep 1
  adb shell input keyevent 111; sleep 1  # cerrar teclado
}

echo "[*] unlock + launch" >&2
adb shell input keyevent KEYCODE_WAKEUP; adb shell input keyevent 82
adb shell am force-stop $PKG; sleep 1
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 6

if wait_cd "Bolivia" 15; then
  echo "[*] onboarding" >&2
  tap_cd "Bolivia"; sleep 1
  tap_cd "Continuar"; sleep 2
  type_in_edittext "0001"
  tap_cd "Ingresar"; sleep 4
  tap_cd "Aceptar y continuar"; sleep 4
else
  echo "[*] onboarding ya hecho" >&2
fi

echo "[*] abrir chatbot" >&2
if ! wait_cd "Chatbot, Consulta directa al RAG" 20; then echo "!! no aparecio home" >&2; exit 1; fi
tap_cd "Chatbot, Consulta directa al RAG"; sleep 8

wait_cd "Escriba aquí su consulta" 60 || { echo "!! no abrio chat" >&2; exit 1; }
sleep 5  # margen para carga del modelo

echo "[*] enviando: $QUESTION" >&2
adb logcat -c
T0=$(date +%s)
type_in_edittext "$QUESTION" || { echo "!! no hay EditText" >&2; exit 1; }
# boton enviar = Button sin content-desc junto al input
dump
SEND=$(python3 - $TMP <<'EOF'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
for m in re.finditer(r'<node[^>]*class="android.widget.Button"[^>]*>', xml):
    tag = m.group(0)
    cd = re.search(r'content-desc="([^"]*)"', tag)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
    if b and (not cd or cd.group(1) == ''):
        x1,y1,x2,y2 = map(int, b.groups())
        if x1 > 900:  # lado derecho
            print(f"{(x1+x2)//2} {(y1+y2)//2}")
            break
EOF
)
[ -z "$SEND" ] && { echo "!! no hay boton send" >&2; exit 1; }
adb shell input tap $SEND
echo "[*] send en $(date +%s)" >&2

echo "[*] esperando stream por logcat..." >&2
elapsed=0; LAST=0; STABLE=0; STARTED=0
while [ $elapsed -lt $RESP_TIMEOUT ]; do
  sleep 5; elapsed=$((elapsed+5))
  N=$(adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null | grep -c "'data',")
  if [ "$N" -gt 0 ]; then STARTED=1; fi
  if [ "$STARTED" = 1 ] && [ "$N" = "$LAST" ]; then
    STABLE=$((STABLE+1)); [ $STABLE -ge 3 ] && break
  else STABLE=0; fi
  LAST=$N
done
T1=$(date +%s)
echo "[*] wall time: $((T1-T0))s, chunks stream: $LAST" >&2

adb shell screencap -p /sdcard/resp.png && adb pull /sdcard/resp.png /tmp/resp.png >/dev/null
adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null > /tmp/llm_log.txt
echo "[*] screenshot: /tmp/resp.png  log: /tmp/llm_log.txt" >&2

python3 - <<'EOF'
import re
lines = open('/tmp/llm_log.txt').read().splitlines()
data = [l for l in lines if "'data'," in l]
load = [l for l in lines if 'loadPrompt:221' in l]
send = [l for l in lines if 'mandando query' in l]
def ts(l):
    m = re.match(r'\d+-\d+ (\d+):(\d+):(\d+\.\d+)', l)
    h,mn,s = m.groups(); return int(h)*3600+int(mn)*60+float(s)
if data and load:
    t_load, t_first, t_last = ts(load[-1]), ts(data[0]), ts(data[-1])
    n = len(data)
    print(f"prompt->1er token: {t_first-t_load:.1f}s")
    print(f"generacion: {t_last-t_first:.1f}s, {n} chunks -> {n/max(t_last-t_first,0.1):.2f} tok/s")
    if send: print(f"total send->fin: {t_last-ts(send[-1]):.1f}s")
    print("=== RESPUESTA ===")
    txt = ''.join(re.search(r"'data', '(.*)'$", l).group(1) for l in data)
    print(txt.replace("\\n", "\n").replace("\\'", "'"))
else:
    print("(sin stream en logcat)")
EOF
