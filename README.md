# mobile-rag
React Native + Rag + Chat
=======

# Primera prueba de concepto.

Esta iniciado usando un template de react native.

Luego se agrego una UI simple de chat la cual tiene interaccion 
con un LLM que se puede descargar.

![latest screenshot of the app](./__screenshot.png)


Proximos pasos:
 * agregar sqlite (https://github.com/sqliteai/sqlite-vector) 
 * agregar settings para tomar base de datos y apuntar modelos aprobados
 * probar modelos y fuentes de datos para calificar la respuesta
 * mas documentacion sobre instalacion local, distribucion y como modificar el software

## Para probar en Android

1) Clonar el repositorio (requiere git)
2) Descargar dependencias (require pnpm, gradle, y un SDK de android)
3) Enchufar un telefono por USB en modo Dev activado
4) Iniciar dev (pnpm start) y instalar la app en el telefono (pnpm run android)

## Crear virtual device

1) Obtener Android SDK y CommandLineTools
2) source environment
3) Crear un descargar imagen: `sdkmanager "system-images;android-33;google_apis;x86_64"`
4) Crear un device: `avdmanager create avd -n Test_Device -k "system-images;android-33;google_apis;x86_64" -p $ANDROID_AVD_HOME`
5) Listar devices: `emulator -list-avds`
6) Usar un device: `emulator -avd Test_Device`

Comandos comunes:
List running emulators: `adb devices`
Install an app: `adb install pandroid/app/build/outputs/apk/release/app-release.apk`
Shell: `adb shell`
Shut down: `adb emu kill`
Stop app: `adb shell am force-stop ar.laia.palmera.dev`

## Para probar en iOS

En curso

## Para probar las consultas

```
$ ./query_database.sh "¿Qué es la PrEP y quién debería considerar tomarla?"
Documento: 2025-06_Recomendaciones de diagnóstico y tratamiento de las Infecciones de Transmisión Sexual.pdf

Documento: Guia_Uso_de_PrEP_como_parte_estrategia_prevencion_combinada.pdf

Documento: Municipios_Genero_y_territorio_08_dig.pdf

```

Es necesario tener instalado SQLite, SQLite-vec, Llama.cpp y jq

