# Mobile v2 — interfaz desktop con motor original

La rama `rag-mobile-v2` conserva el frontend de staging y restaura los hooks de inferencia, chat y recuperación de `80eb5d3` byte por byte. No incluye los ajustes experimentales de contexto, presupuesto de prompt, hilos, precarga ni logs. Los cambios funcionales anteriores se respaldaron fuera de ambos repositorios antes de retirarlos.

## Alcance

- Se mantienen las pantallas, fuentes, imágenes, CSS y presentación de respuestas de `palmera-web` (referencia `3a117d1`, mismo árbol que staging `16f67ed`).
- La WebView y el adaptador transportan las consultas al hook original `send(question)`. El historial del motor sigue siendo el del hook original.
- El texto parcial del hook original se presenta progresivamente en la misma burbuja. No se descarta la respuesta por el timeout agregado de diez minutos.
- No se modifican pesos, corpus ni prompt. El paquete local recupera los parámetros de contexto del manifiesto incluido en `app-dev-release.apk`.
- Registro y edición de perfil conservan la integración online ya preparada. La URL procede de configuración local ignorada, sin credenciales incrustadas.
- Los controles visuales de feedback permanecen; su envío queda pendiente y devuelve un error explícito. No se simula guardado. No hay cola ni endpoint nuevo bloqueando la respuesta.
- El visor PDF sigue siendo el nativo anterior. No se afirma identidad visual con el visor PDF del navegador.
- El backend de `its-rag` vuelve a su código base. No se despliega ni se aplica ninguna migración.

## Build

Usar `pnpm install --frozen-lockfile`, `pnpm web:install` y una configuración `mobile-v2.local.json` a partir del ejemplo (o `PALMERA_BACKEND_URL`). `pnpm web:build` prepara los recursos autocontenidos. Desde `android/`, compilar `assembleLocalDebug -PreactNativeArchitectures=arm64-v8a`. El paquete privado existente se valida por el procedimiento original; no se copian datos desde otros entornos ni se modifican sus controles de acceso.

## Validación

La revisión de archivos verifica que los hooks originales y los archivos nativos no tengan diferencias con la base. Las pruebas de adaptador usan datos sintéticos; no prueban inferencia ni calidad clínica. Las pruebas visuales comparan el frontend con staging.

Se realizaron pruebas en el Motorola después de la preparación inicial; sus resultados y límites están en `MOBILE-V2-DIAGNOSTICS.md`. No se confirmó una respuesta completa ni tiempos aceptables. Una compilación correcta no demuestra que el RAG funcione.

## Pendiente: selector Online / Offline

Solicitud del usuario (2026-11-06), para después de resolver la generación local:

- Agregar una selección explícita de modo Online / Offline en la APK.
- En Online, enviar las consultas al mismo backend de desktop, en `palmera.laia.ar`, usando el registro real del piloto y sus contratos de consulta y feedback. El origen debe seguir siendo configurable, sin credenciales ni URLs incrustadas en componentes.
- En Offline, responder mediante el RAG y los modelos locales del teléfono, conservando el feedback en cola para sincronizarlo cuando haya conexión.
- Conservar la interfaz y la presentación de las respuestas de desktop en ambos modos.
- Definir el comportamiento al perder conexión o cambiar de modo durante una consulta y cómo se conserva el historial entre los dos motores; no implementar un cambio automático de motor sin una decisión explícita.

Esta funcionalidad queda en el TODO; todavía no se implementó.


## Resultado de preparación (2026-11-06)

- Hooks, tipos y módulo nativo del RAG: comparación byte por byte contra `80eb5d3`, sin diferencias.
- Código del backend restaurado a la base; documentos preexistentes preservados.
- Pasaron el chequeo de tipos nativo y web, lint del adaptador, 38 pruebas de lógica/arranque/adaptador y cinco pruebas de navegador. Estas últimas incluyen respuesta progresiva, llegada final después de diez minutos simulados y comparación de nueve vistas con staging usando datos sintéticos.
- `assembleLocalDebug` arm64 finalizó correctamente. Los 29 archivos del paquete coinciden por tamaño y SHA-256 con el manifiesto. La configuración LLM de la APK coincide con la de `app-dev-release.apk`; el HTML y el bundle JavaScript están incluidos.
- Los cambios retirados se preservaron en `visual-only-backup-20261106-162705` dentro del directorio de trabajo de Codex, fuera de ambos repositorios.
- No se utilizó el teléfono, no se instaló la APK, no se hizo push ni se desplegó nada durante esta preparación. Falta la prueba de inferencia real con el usuario; no se promete rendimiento ni que el fallo esté resuelto.


## Pendiente: reiniciar chat sin cerrar sesión

Solicitud del usuario (2026-11-06), posterior a recuperar la respuesta del RAG:

- Agregar una opción visible de Nuevo chat / Reiniciar chat.
- Detener la consulta en curso y limpiar los mensajes, reintentos e historial de contexto de esa conversación.
- Conservar el registro, los modelos y los documentos instalados; no exigir cerrar sesión ni reiniciar la app.
- Permitir iniciar una conversación vacía sin arrastrar siempre la anterior al navegar.

Solo TODO: no se implementa ahora. La prioridad sigue siendo que el RAG responda.


## Variante de diagnóstico separada

Consultar `docs/MOBILE-V2-DIAGNOSTICS.md`. El código base conserva la configuración visual y los hooks originales; el build de diagnóstico es opcional y restaura los archivos temporales al finalizar.

- Validar sin escribir ni compilar: `python scripts/build-mobile-diagnostic.py --context 8192 --check`.
- Compilar el diagnóstico: `python scripts/build-mobile-diagnostic.py --context 8192`.
- El script no instala, no ejecuta consultas y no se conecta al teléfono.
- Las APK y el paquete privado se mantienen ignorados por Git. Quien clone necesita preparar localmente el paquete por el procedimiento existente.
