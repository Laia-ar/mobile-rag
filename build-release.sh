#!/bin/bash
# Uso: ./build-release.sh [local|cloud|vultr]
# El paquete en android/app/src/main/assets/knowledge.current debe coincidir con el flavor:
# local = LLM GGUF bundleado; cloud = provider "openrouter" (sin GGUF);
# vultr = provider "openrouter" + llm.baseUrl apuntando al servidor propio.

set -e

FLAVOR="${1:-local}"
[ "$FLAVOR" = "local" ] || [ "$FLAVOR" = "cloud" ] || [ "$FLAVOR" = "vultr" ] || {
  echo "Flavor inválido: $FLAVOR (usar local|cloud|vultr)" >&2
  exit 1
}
FLAVOR_CAP="$(tr '[:lower:]' '[:upper:]' <<< "${FLAVOR:0:1}")${FLAVOR:1}"

JAVA_MAJOR=$(java -version 2>&1 | awk -F '"' '/version/ { split($2, version, "."); print version[1]; exit }')
[ "$JAVA_MAJOR" = "17" ] || {
  echo "Este build requiere JDK 17. Configurá JAVA_HOME antes de continuar." >&2
  exit 1
}

MANIFEST=android/app/src/main/assets/knowledge.current/manifest.json
test -f "$MANIFEST" || {
  echo "Falta el paquete android/app/src/main/assets/knowledge.current" >&2
  exit 1
}

IS_CLOUD=$(grep -c '"provider": "openrouter"' "$MANIFEST" || true)
if { [ "$FLAVOR" = "cloud" ] || [ "$FLAVOR" = "vultr" ]; } && [ "$IS_CLOUD" = "0" ]; then
  echo "knowledge.current no es una variante cloud (sin provider openrouter)" >&2; exit 1
fi
if [ "$FLAVOR" = "local" ] && [ "$IS_CLOUD" != "0" ]; then
  echo "knowledge.current es una variante cloud; buildear con: $0 cloud" >&2; exit 1
fi
if [ "$FLAVOR" = "vultr" ] && ! grep -q '"baseUrl"' "$MANIFEST"; then
  echo "knowledge.current no declara llm.baseUrl (servidor propio)" >&2; exit 1
fi

cd android
./gradlew --no-problems-report "validateOfflineKnowledge" "assemble${FLAVOR_CAP}Release"
cd ..

find "android/app/build/outputs/apk/$FLAVOR/release" -name "*.apk" -exec ls -lah {} \;
