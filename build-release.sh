#!/bin/bash

set -e

JAVA_MAJOR=$(java -version 2>&1 | awk -F '"' '/version/ { split($2, version, "."); print version[1]; exit }')
[ "$JAVA_MAJOR" = "17" ] || {
  echo "Este build requiere JDK 17. Configurá JAVA_HOME antes de continuar." >&2
  exit 1
}

test -f android/app/src/main/assets/knowledge.current/manifest.json || {
  echo "Falta el paquete android/app/src/main/assets/knowledge.current" >&2
  exit 1
}

cd android
./gradlew --no-problems-report validateOfflineKnowledge assembleProdRelease
cd ..

find android/app/build/outputs/apk/prod/release -name "*.apk" -exec ls -lah {} \;

