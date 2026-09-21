# Guía — Integración backend, conocimiento local y APK offline v0

**Fecha:** 2026-08-07
**Alcance:** preparación e implementación entre los repositorios hermanos `its-rag` y `mobile-rag`
**Diseño canónico:** `its-rag/docs/PRD-Integracion-Mobile-Offline-v0.md` y `its-rag/docs/SDD-Integracion-Backend-Mobile-Offline-v0.md`

## Estado de esta rama (2026-08-10)

Implementado en `feature/offline-backend-integration`:

- bootstrap validado de `manifest.json` a almacenamiento persistente;
- SQLite read-only sin nombre de DB ni `corpus_id` hardcodeados;
- búsqueda híbrida FTS5 + sqlite-vec y fuentes con documento/página;
- carga de modelos y parámetros desde el manifiesto;
- `ChatbotScreen`, guías y fuentes conectados al runtime real;
- visor PDF Android nativo con apertura en la página del chunk;
- guardado persistente de guías y fragmentos mediante AsyncStorage;
- validación offline de IDs por país usando allowlists de hashes SHA-256;
- receptor de automatización limitado a builds debug y release sin `debuggable` forzado;
- datos mock y `Chat.tsx` legado retirados.

Estado local actual: `knowledge.current` ya se genera con la base indexada recibida, los PDF asociados a los corpus oficiales, MiniLM GGUF, Qwen3.5 0.8B GGUF, prompt y checksums. Los binarios quedan ignorados por Git. Para la prueba de desarrollo el acceso está deshabilitado explícitamente; antes de `prodRelease` faltan los IDs reales por país.

## 1. Qué resuelve esta guía

Esta guía indica dónde viven las guías, la DB, los modelos y los artefactos de build; qué archivos conectar; cómo revisar `.gitignore`; y en qué orden avanzar hasta obtener un APK funcional sin conexión.

No incluye claves, códigos de acceso reales, nombres de DB productivas ni credenciales de firma. Los ejemplos usan placeholders.

## 2. Mapa de ubicaciones

| Elemento | Ubicación de trabajo | ¿Versionado? | Observación |
|---|---|---:|---|
| PDFs fuente del pool backend | `its-rag/data/documents/` | No | Montado read-only en Docker; hoy está ignorado |
| PDFs subidos por API | `its-rag/backend/data/uploads/` | No | Runtime backend; ignorado por `/backend/data` |
| DB operativa backend | `its-rag/backend/data/` | No | Nunca copiar completa al APK |
| Exports backend | `its-rag/backend/data/exports/` | No | ZIP/SQLite generados; cubiertos por `/backend/data` |
| Código del exportador | `its-rag/backend/app/services/mobile_export/` | Sí | Se debe implementar |
| Contratos y ejemplos seguros | `its-rag/docs/` | Sí | Sin datos reales ni secretos |
| Paquete seed para build Android | `mobile-rag/android/app/src/main/assets/knowledge.current/` | No | La carpeta completa está ignorada |
| Assets nativos de sqlite/llama | `mobile-rag/android/app/src/main/assets/ggml-hexagon/` | Sí | No mezclar con `knowledge.current` |
| Estado runtime del teléfono | `RNFS.DocumentDirectoryPath/knowledge/` | No aplica | Persistente y privado de la app |
| Estado/favoritos del usuario | AsyncStorage dentro del sandbox de la app | No aplica | Separado del corpus read-only; migrable a SQLite si crece |
| Keystore release local | fuera de Git; referencia desde Gradle properties | No | `android/keys/` ya está ignorado |
| APK generado | `android/app/build/outputs/apk/prod/release/` | No | Artefacto de release, no fuente |

## 3. Estructura esperada del seed Android

Antes de construir la variante offline debe existir localmente:

```text
mobile-rag/android/app/src/main/assets/knowledge.current/
├── manifest.json
├── database/
│   └── corpus.sqlite
├── documents/
│   ├── AR/<guia>.pdf
│   └── BO/<guia>.pdf
├── models/
    ├── <chat_model>.gguf
│   └── <embedding_model>.gguf
└── prompts/
    └── clinical-system.txt
```

Reglas:

- `corpus.sqlite` es una exportación mobile sanitizada, no la DB del backend.
- El modelo de chat debe ser generativo y compatible con `llama.rn`.
- El modelo de embeddings debe coincidir con los vectores de `chunks_vec`.
- Los PDFs usan paths relativos declarados en DB/manifest.
- Cada archivo figura en `manifest.json` con SHA-256 y tamaño.
- La ausencia de cualquiera de los archivos requeridos debe detener el build o el bootstrap.

## 4. Repaso obligatorio de `.gitignore`

### 4.1 Backend

Desde Git Bash, dentro de `its-rag`:

```bash
git status --short --branch
git check-ignore -v --no-index \
  backend/data/itsrag.db \
  backend/data/exports/example.zip \
  data/documents/example.pdf \
  models/example.gguf \
  .env
```

El resultado esperado es que cada ruta esté cubierta por `.gitignore`.

El root `.gitignore` ya cubre DBs, SQLite, modelos, `data/documents`, `data/uploads`, `backend/data` y `.env`. No eliminar estas reglas para “hacer más fácil” el empaquetado.

### 4.2 Mobile

Desde `mobile-rag`:

```bash
git status --short --branch
git check-ignore -v --no-index \
  android/app/src/main/assets/knowledge.current/database/corpus.sqlite \
  android/app/src/main/assets/knowledge.current/manifest.json \
  android/app/src/main/assets/knowledge.current/documents/example.pdf \
  android/app/src/main/assets/knowledge.current/models/example.gguf \
  android/keys/release.keystore \
  .env
```

La regla actual `/android/app/src/main/assets/knowledge.*` ignora todo el paquete seed, incluido su manifiesto. Esto es intencional para los artefactos reales. El schema y el ejemplo público deben vivir en una ruta versionada separada, no mediante una excepción dentro de `knowledge.current`.

### 4.3 Regla de seguridad

No ejecutar `git add -f` sobre:

- `.env`;
- DB operativas o exportadas;
- PDFs reales sin aprobación de licencia;
- modelos;
- `knowledge.current`;
- keystores o archivos de firma.

Antes de cualquier commit, revisar:

```bash
git status --short
git diff -- .gitignore
git diff --cached --name-only
```

## 5. Orden de implementación

### Paso 1 — Congelar el contrato

Antes de escribir el exportador, acordar:

- LLM GGUF generativo definitivo;
- modelo de embeddings;
- dimensión full y dimensión de retrieval;
- prefijo de query y normalización;
- países incluidos;
- versión mínima de app;
- visor PDF;
- formato de credencial offline;
- derechos para redistribuir PDFs/modelos.

Sin este paso, backend y mobile pueden producir embeddings incompatibles aunque ambos “funcionen”.

### Paso 2 — Preparar las guías en backend

Las guías pueden ingresar por:

1. pool local `its-rag/data/documents/`; o
2. upload administrado por la API, almacenado bajo `backend/data/uploads/`.

Luego se crea/actualiza un corpus desde la WebApp/backend y se espera a que cada documento tenga:

- `document_id` estable;
- PDF existente;
- país e institución;
- fecha/año;
- chunks indexados;
- `page` o `page_range`;
- FTS;
- embedding de 256 dimensiones en `chunks_vec`.

No usar el filename como identificador funcional. El export renombra el PDF a `<document_id>.pdf` y guarda el título en metadata.

### Paso 3 — Implementar el exportador backend

Touchpoints:

| Archivo/ruta | Cambio esperado |
|---|---|
| `backend/app/services/mobile_export/` | Crear DB portable, copiar PDFs, manifestar y comprimir |
| `backend/app/api/endpoints/corpus.py` | Implementar `export` y `download_export` |
| `backend/app/models/corpus.py` | Completar respuesta/requests de export si hace falta |
| `backend/app/models/db/corpus.py` | Agregar metadata de documento/bbox solo si se aprueba |
| `backend/alembic/versions/` | Migración obligatoria para columnas nuevas |
| `backend/tests/` | Sanitización, schema, checksums y descarga |

El exporter debe crear una nueva SQLite por allowlist. Comprobar que no existan tablas de usuarios, sesiones, logs, preferencias, prompts o QA en el resultado.

### Paso 4 — Generar y validar un paquete golden

Una vez implementado el export:

1. Elegir un corpus de prueba sin información sensible.
2. Generar el paquete.
3. Descomprimirlo fuera de Git.
4. Ejecutar `PRAGMA integrity_check`.
5. Revisar tablas con `.tables`.
6. Confirmar que cada `documents.pdf_path` existe.
7. Ejecutar preguntas golden y anotar los `chunk_id` esperados.
8. Verificar los SHA-256 del manifiesto.

El paquete golden de desarrollo tampoco se versiona salvo que sea un fixture mínimo, sintético y aprobado explícitamente.

### Paso 5 — Colocar el seed del APK

Generar o copiar el contenido validado a:

```text
mobile-rag/android/app/src/main/assets/knowledge.current/
```

El script versionado `scripts/prepare-offline-package.ps1` recibe rutas e IDs como parámetros, copia solamente los PDF asociados a los corpus elegidos, adapta las rutas en una copia de la DB y crea el manifiesto con checksums. Nunca modifica la DB original.

Después comprobar:

```bash
test -f android/app/src/main/assets/knowledge.current/manifest.json
test -f android/app/src/main/assets/knowledge.current/database/corpus.sqlite
test -d android/app/src/main/assets/knowledge.current/documents
test -d android/app/src/main/assets/knowledge.current/models
git status --short
```

`git status` no debe mostrar el paquete porque está ignorado.

### Paso 6 — Instalar el conocimiento al primer arranque

Crear `KnowledgePackageService` y reemplazar la copia ad hoc de los hooks.

Flujo:

1. leer `manifest.json` desde assets;
2. comparar con la versión activa;
3. copiar a `DocumentDirectoryPath/knowledge/staging/<version>`;
4. validar paths, tamaños, hashes y schema;
5. mover a `versions/<version>`;
6. escribir `active.json` de forma atómica;
7. abrir DB/modelos desde la versión activa;
8. conservar la anterior hasta confirmar arranque correcto.

No usar `TemporaryDirectoryPath` para DB ni modelos productivos.

### Paso 7 — Conectar el motor a la UI activa

Touchpoints mobile:

| Archivo actual | Acción |
|---|---|
| `components/Chat.tsx` | Retirado; su streaming útil fue unificado en `useOfflineChat` |
| `hooks/useRagEngine.ts` | Eliminar DB/corpus hardcodeados y devolver fuentes completas |
| `hooks/useLlamaEngine.ts` | Cargar paths/config del manifiesto y separar chat de embeddings |
| `components/ChatbotScreen.tsx` | Conectado a `useOfflineChat`; no consume contenido mock |
| `data/chatbotMock.ts` | Retirado del proyecto |
| `components/SourcesBottomSheet.tsx` | Consumir `SourceReference` real |
| `components/GuidesScreen.tsx` | Consultar `documents` en SQLite |
| `data/guidesMock.ts` | Retirado del proyecto |
| `test_knowledge.sh` | Leer manifest/corpus dinámicos y eliminar nombres históricos |
| `README.md` | Documentar el flujo real una vez validado |

El envío debe hacer:

```text
pregunta -> embedding -> búsqueda híbrida -> prompt con chunks
         -> generación local -> texto + fuentes -> UI
```

Un test funcional debe fallar si la respuesta productiva vuelve a usar mocks o entrega `sources=[]` cuando la consulta golden tiene resultados.

### Paso 8 — PDFs y posición

Agregar una pantalla/adaptador de visor PDF que reciba:

```text
pdfAbsolutePath
initialPage
optionalNormalizedBoundingBox
```

Para v0:

- abrir por `page`;
- mostrar `content`/`text_for_display` en el modal;
- mostrar título, institución, país, año y rango;
- guardar `chunk_id` y snapshot del fragmento.

Para resaltado exacto:

1. conservar `bbox` desde `item.prov` de Docling;
2. normalizar coordenadas y orientación;
3. persistir `bbox_json` en backend/export;
4. proyectar un overlay en la página del visor;
5. probar PDFs rotados, escaneados y con múltiples columnas.

### Paso 9 — Persistir guías y fragmentos

La v0 persiste snapshots completos de guías y fragmentos en AsyncStorage. Si el volumen o las consultas aumentan, se migra esa misma estructura a una DB escribible separada del corpus.

No escribir dentro de `corpus.sqlite`, porque se abre read-only y se reemplaza por versión.

### Paso 10 — Conectar país y acceso

Touchpoints:

| Archivo | Cambio |
|---|---|
| `components/CountrySelectorScreen.tsx` | Pasar `argentina`/`bolivia` a `LoginScreen` |
| `components/LoginScreen.tsx` | Validar credencial, no solo texto no vacío |
| `services/auth/accessService.ts` | Comparar el hash del ID con la allowlist del país |

No incluir códigos reales en TypeScript ni en texto plano. La v0 guarda únicamente SHA-256 de `PAIS:CODIGO` en el manifiesto. Esto evita exponer texto plano, pero los códigos cortos siguen siendo vulnerables a fuerza bruta si alguien extrae el APK; para una versión de mayor seguridad conviene migrar a credenciales firmadas con expiración.

### Paso 11 — Endurecer Android release

Revisar:

- `android/app/build.gradle` para firma, versión y assets grandes;
- `android/app/src/main/AndroidManifest.xml`;
- `android/app/proguard-rules.pro` si se activa minificación;
- tamaño de cada ABI/modelo;
- permisos de red: pueden quedar para OTA futuro, pero la prueba v0 debe pasar sin red.

Bloqueadores actuales:

- falta el paquete indexado real y su contrato de modelo compatible;
- falta aprobar y suministrar el LLM generativo;
- falta implementar/validar el export backend que produzca este manifiesto;
- falta la validación manual en un dispositivo sin red.

El visor PDF ya está implementado con `PdfRenderer` nativo. El receptor `TestingEventReceiver` se declara solo en `src/debug`.

La firma release debe leer placeholders `MYAPP_UPLOAD_*` desde propiedades locales/secret store. No escribir passwords ni rutas privadas reales en el repositorio.

## 6. Validación estática recomendada

No existe un script `type-check` en `package.json`; usar:

```bash
cd mobile-rag
pnpm exec tsc --noEmit
pnpm exec eslint \
  components/ChatbotScreen.tsx \
  components/SourcesBottomSheet.tsx \
  components/GuidesScreen.tsx \
  hooks/useRagEngine.ts \
  hooks/useLlamaEngine.ts
```

Backend:

```bash
cd its-rag/backend
uv run pytest -v
uv run ruff check app tests
uv run mypy app
```

Los comandos deben ajustarse a los archivos modificados y al estado real de dependencias. No confundir validación estática con prueba en dispositivo.

## 7. Construcción del APK

Después de configurar la firma fuera de Git:

En Git Bash:

```bash
cd mobile-rag/android
export JAVA_HOME=/ruta/al/jdk-17
./gradlew --no-problems-report assembleProdRelease
```

En PowerShell:

```powershell
cd mobile-rag/android
$env:JAVA_HOME = "C:\ruta\al\jdk-17"
./gradlew.bat --no-problems-report assembleProdRelease
```

Salida esperada:

```text
mobile-rag/android/app/build/outputs/apk/prod/release/
```

Antes de instalar:

- confirmar firma del APK;
- listar el contenido y verificar `assets/knowledge.current`;
- verificar que no haya `.env`, claves privadas o archivos no declarados;
- registrar tamaño y SHA-256 del APK;
- conservar versión de manifest/DB/modelos asociada al release.

## 8. Matriz manual de aceptación offline

La validación en dispositivo debe realizarse con una instalación limpia:

- [ ] Instala `prodRelease` sin errores.
- [ ] Primer arranque completa bootstrap sin red.
- [ ] Credencial AR válida entra; BO válida entra.
- [ ] Credencial inválida, vencida o de otro país se rechaza.
- [ ] El chat responde a una pregunta golden.
- [ ] La respuesta usa `chunk_id` reales.
- [ ] Fuentes abre el documento y la página esperada.
- [ ] El fragmento mostrado coincide con DB/PDF.
- [ ] Guardar fragmento persiste tras cierre forzado.
- [ ] Guardar guía persiste tras cierre forzado.
- [ ] Búsqueda de guías usa documentos reales, no mocks.
- [ ] Falta de evidencia produce respuesta segura.
- [ ] Reinicio del teléfono conserva paquete y guardados.
- [ ] Modo avión durante toda la prueba no rompe el flujo.

## 9. Checklist antes de commit/PR

- [ ] Solo código, docs, schemas, migraciones, scripts y tests intencionales están modificados.
- [ ] No aparecen PDFs, DBs, modelos, ZIPs, `.env` ni keystores.
- [ ] No hay `corpus_id`, filenames históricos ni códigos reales hardcodeados.
- [ ] `.gitignore` conserva las protecciones de ambos repos.
- [ ] El export contiene únicamente la allowlist mobile.
- [ ] Los mocks no están en el camino productivo.
- [ ] Se documentaron tests estáticos y resultado manual por separado.
- [ ] No se subió ningún artefacto con `git add -f`.

## 10. Primer corte de trabajo recomendado

Para empezar sin abrir demasiados frentes:

1. Aprobar modelos y parámetros del manifiesto.
2. Implementar el exporter backend sanitizado.
3. Generar un paquete golden con DB, PDFs, prompt, modelos y hashes.
4. Copiarlo a `android/app/src/main/assets/knowledge.current/`.
5. Ejecutar validación estática y construir `assembleProdRelease`.
6. Probar en modo avión una consulta golden, apertura por página y persistencia.
