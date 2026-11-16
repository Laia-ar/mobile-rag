# Diagnóstico offline — estado registrado

Este documento registra las pruebas realizadas durante el trabajo de noviembre de 2026. No afirma que el fallo esté resuelto.

## Resultado observado

- En una consulta, el prompt formateado completo midió 5728 tokens: 5706 de instrucciones y fuentes, cinco fragmentos y un solo mensaje de conversación.
- El motor confirmó `n_ctx=4096` y `n_ctx_seq=4096`. La generación devolvió `Context is full`.
- Una variante separada cambió únicamente el contexto de generación a 8192, conservando pesos, corpus, prompt, hilos y máximo de salida (512).
- El motor confirmó 8192 por secuencia y recibió el mismo prompt de 5728 tokens. Apareció texto parcial en la interfaz. No se confirmó una respuesta completa.
- El primer fragmento llegó a los 509 segundos y ocho eventos de salida a los 620 segundos desde el envío. Hubo una pausa en segundo plano: Android reportó el proceso congelado y luego activo. Esos tiempos incluyen esa pausa y no son un benchmark limpio de inferencia.
- Sigue pendiente explicar y resolver la lentitud. No está validado el objetivo de menos de tres minutos.

## Separación de variantes

La rama conserva el motor de `80eb5d3` sin ajustes experimentales. La APK estética usa el manifiesto local base (4096 durante estas pruebas). El script opcional `scripts/build-mobile-diagnostic.py` agrega los registros de medición y cambia temporalmente solo `llm.contextParams.n_ctx`; al finalizar restaura hook, manifiesto privado y APK estética. No instala nada.

La APK de 8192 para compartir es una compilación de diagnóstico, no una versión final validada. Sus modelos y documentos van incluidos; el registro inicial mantiene la integración online acordada.

## Reproducir con los recursos locales preparados

```bash
python scripts/build-mobile-diagnostic.py --context 8192 --check
python scripts/build-mobile-diagnostic.py --context 8192
```

Salida: `android/app/build/diagnostics/app-local-debug-context-8192-diagnostic.apk`.

Las APK, configuraciones locales, corpus, modelos, credenciales y manifiestos privados no se incluyen en Git. Se conservan localmente. No se publica el backend ni se aplican migraciones.


## Artefacto local verificado el 2026-11-16

La APK de 8192 conservada de las pruebas anteriores tiene SHA-256:

`c7e57044810a67d116759bd2c8ed03dab4f1362187c26624fcd65c30e48c33cd`

Se comparte como diagnóstico; no se recompiló ni se declaró validada funcionalmente durante la preparación de la rama.
