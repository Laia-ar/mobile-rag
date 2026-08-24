# InfectoAssist Mobile

Aplicación React Native de consulta clínica RAG que funciona completamente offline en Android. La UI, SQLite, sqlite-vec, los modelos GGUF y los PDFs se ejecutan dentro del dispositivo.

## Estado

El código productivo ya no consume datos mock. El runtime espera un paquete privado y versionado en:

```text
android/app/src/main/assets/knowledge.current/
├── manifest.json
├── database/corpus.sqlite
├── documents/AR/*.pdf
├── documents/BO/*.pdf
├── models/all-MiniLM-L6-v2-ggml-model-f16.gguf
├── models/Qwen3.5-0.8B-Q4_K_M.gguf
└── prompts/clinical-system.txt
```

El paquete está ignorado por Git. El contrato de ejemplo está en `config/knowledge-manifest.example.json` y la guía completa en `docs/GUIA-INTEGRACION-Y-APK-OFFLINE-v0.md`.

El manifiesto define dinámicamente el corpus de cada país, paths, dimensiones, parámetros de inferencia, hashes de acceso y checksums. No se versionan códigos reales, DBs, PDFs, modelos ni credenciales.

El paquete local se puede regenerar con `scripts/prepare-offline-package.ps1`. Los IDs de corpus se pasan como parámetros: no quedan hardcodeados en el código. Para pruebas internas sin IDs asignados, el manifiesto admite `disabled-for-development`; `prodRelease` rechaza ese modo y exige allowlists reales.

## Flujo offline

```text
manifest + archivos
        ↓ validación SHA-256
almacenamiento persistente de la app
        ↓
pregunta → embedding GGUF → sqlite-vec + FTS5 → chunks
        → LLM GGUF → respuesta + fuentes
        → PDF nativo en la página recuperada
```

Las guías completas y los snapshots de fragmentos guardados persisten por separado en AsyncStorage.

## Validación estática

Con dependencias ya instaladas:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint components hooks services types App.tsx --ext .ts,.tsx
npm run test:unit
```

No hace falta iniciar Metro, un emulador ni ADB para estas verificaciones.

## Desarrollo Android

```bash
pnpm start
pnpm run android:dev
```

Estos comandos requieren Android SDK y un dispositivo/emulador configurado. El equipo ejecuta manualmente las pruebas de runtime.

## APK release offline

Una vez colocado y validado `knowledge.current` y configurada la firma fuera del código:

```bash
./build-release.sh
```

El build Android de este checkout requiere JDK 17. Definí `JAVA_HOME` a un JDK 17 antes de ejecutar el script.

El script ejecuta `validateOfflineKnowledge` y `assembleProdRelease`. La salida queda en:

```text
android/app/build/outputs/apk/prod/release/
```

El build falla si falta el manifiesto, un archivo declarado, un hash de acceso para un país incluido o un checksum válido.

## Seguridad

- Los IDs se normalizan y se comparan localmente contra hashes SHA-256 por país.
- Los hashes evitan texto plano, pero los códigos cortos pueden ser vulnerables a fuerza bruta; una versión posterior debería usar credenciales firmadas con vencimiento.
- `TestingEventReceiver` solo está disponible en builds debug.
- El release no fuerza `android:debuggable`.
- No usar `git add -f` para incluir `knowledge.current`, keystores o `.env`.

Nota: este checkout contiene material de firma histórico ya trackeado. No fue eliminado ni rotado automáticamente; requiere una decisión explícita del responsable y rotación si alguna credencial estuvo expuesta.
