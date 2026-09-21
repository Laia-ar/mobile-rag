#!/bin/bash
# Uso: ./run_model_test.sh <model_id> <ruta_gguf>
# Onboarding + 2 preguntas + métricas. Resultados en results/<model_id>/
set -u
MODEL_ID="$1"
PKG="${PKG:-ar.laia.palmera.local}"
TMP=/tmp/ui_dump.xml
RES=/home/didi/code/mobile-rag/results/$MODEL_ID
mkdir -p "$RES"

Q1="Cual es el esquema de primera linea de TARV en adultos?"
Q2="Si la persona es alergica a la penicilina, que antibiotico le puedo dar para la sifilis?"

dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml > $TMP; }

tap_cd() { # tap por content-desc, con bounds frescos
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
  adb shell input text "${1// /%s}"; sleep 1
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

wait_stream() { # espera fin de stream por logcat; $1=timeout_s
  local elapsed=0 last=-1 stable=0 started=0 n
  while [ $elapsed -lt "$1" ]; do
    sleep 5; elapsed=$((elapsed+5))
    if ! adb shell pidof $PKG >/dev/null 2>&1 || [ -z "$(adb shell pidof $PKG 2>/dev/null)" ]; then
      echo "CRASH"
      return 2
    fi
    n=$(adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null | grep -c "'data'," || echo 0)
    [ "$n" -gt 0 ] && started=1
    if [ "$started" = 1 ] && [ "$n" = "$last" ]; then
      stable=$((stable+1)); [ $stable -ge 3 ] && return 0
    else stable=0; fi
    last=$n
  done
  return 1
}

extract() { # $1=logfile $2=outfile -> métricas + respuesta
  python3 - "$1" "$2" <<'EOF'
import re, sys
lines = open(sys.argv[1]).read().splitlines()
data = [l for l in lines if "'data'," in l]
load = [l for l in lines if 'loadPrompt:221' in l]
send = [l for l in lines if 'mandando query' in l]
def ts(l):
    m = re.match(r'\d+-\d+ (\d+):(\d+):(\d+\.\d+)', l)
    h,mn,s = m.groups(); return int(h)*3600+int(mn)*60+float(s)
out = []
if data and load:
    t_load, t_first, t_last = ts(load[-1]), ts(data[0]), ts(data[-1])
    n = len(data)
    m2 = re.search(r'num_prompt_tokens=(\d+)', load[-1])
    out.append(f"prompt_tokens={m2.group(1) if m2 else '?'}")
    out.append(f"ttft_s={t_first-t_load:.1f}")
    out.append(f"gen_s={t_last-t_first:.1f} gen_chunks={n} tok_s={n/max(t_last-t_first,0.1):.2f}")
    if send: out.append(f"total_s={t_last-ts(send[-1]):.1f}")
    txt = ''.join(re.search(r"'data', '(.*)'$", l).group(1) for l in data)
    txt = txt.replace("\\n", "\n").replace("\\'", "'")
else:
    out.append("SIN STREAM")
    txt = ""
if send:
    m3 = re.search(r'<fuentes>(.*?)</fuentes>', send[-1], re.S)
    if m3:
        fuentes = [f.strip() for f in m3.group(1).replace('\\n','\n').split('\n') if f.strip() and not f.strip().isupper() and len(f.strip())>3]
        out.append("fuentes=" + ' | '.join(dict.fromkeys(fuentes)))
open(sys.argv[2], 'w').write('\n'.join(out) + '\n=== RESPUESTA ===\n' + txt + '\n')
print('\n'.join(out))
EOF
}

ask() { # $1=pregunta $2=tag
  adb logcat -c
  type_in_edittext "$1" || { echo "NO_EDITTEXT"; return 1; }
  tap_send || { echo "NO_SEND"; return 1; }
  echo "send $2: $(date +%H:%M:%S)"
  wait_stream 600
  local rc=$?
  adb logcat -d --pid=$(adb shell pidof $PKG 2>/dev/null) > "$RES/log_$2.txt" 2>/dev/null
  adb shell screencap -p /sdcard/resp_$2.png; adb pull /sdcard/resp_$2.png "$RES/resp_$2.png" >/dev/null 2>&1
  [ $rc = 2 ] && { echo "CRASH durante $2"; return 2; }
  extract "$RES/log_$2.txt" "$RES/$2.txt"
  return 0
}

# ---- flujo principal ----
echo "== unlock + launch =="
adb shell svc power stayon true 2>/dev/null
adb shell input keyevent KEYCODE_WAKEUP; adb shell input keyevent 82
adb shell am force-stop $PKG; sleep 1
adb logcat -c
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 8

# onboarding con reintentos
for attempt in 1 2 3; do
  if has_cd "Chatbot, Consulta directa al RAG"; then break; fi
  if has_cd "Bolivia"; then
    tap_cd "Bolivia"; sleep 1; tap_cd "Continuar"; sleep 2
  fi
  if has_cd "Ingresar"; then
    type_in_edittext "0001"
    tap_cd "Ingresar"; sleep 4
    has_cd "Ingresar" && { adb shell input tap 540 1842; sleep 4; }
  fi
  if has_cd "Aceptar y continuar"; then
    tap_cd "Aceptar y continuar"; sleep 4
  fi
done
if ! has_cd "Chatbot, Consulta directa al RAG"; then
  echo "FAIL_ONBOARDING"; adb shell screencap -p /sdcard/fail.png; adb pull /sdcard/fail.png "$RES/fail.png" >/dev/null 2>&1
  exit 1
fi

echo "== abrir chat (carga modelo) =="
tap_cd "Chatbot, Consulta directa al RAG"; sleep 20
has_cd "Escriba aquí su consulta" || { sleep 20; has_cd "Escriba aquí su consulta" || { echo "FAIL_CHAT"; exit 1; }; }

# si el build tiene precarga, esperar a que termine antes de medir Q1
sleep 5
if adb logcat -d --pid=$(adb shell pidof $PKG 2>/dev/null) 2>/dev/null | grep -q "warmup: precargando"; then
  echo "== esperando warmup =="
  for i in $(seq 1 120); do
    adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null | grep -q "warmup: listo" && break
    adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null | grep -q "warmup falló" && break
    sleep 5
  done
  adb logcat -d --pid=$(adb shell pidof $PKG) 2>/dev/null | grep "warmup" | tail -2
fi
sleep 5

echo "== Q1 =="
ask "$Q1" q1 || echo "Q1 status: $?"
if adb shell pidof $PKG >/dev/null 2>&1 && [ -n "$(adb shell pidof $PKG)" ]; then
  echo "== Q2 =="
  sleep 3
  ask "$Q2" q2 || echo "Q2 status: $?"
fi
echo "== fin $MODEL_ID =="
