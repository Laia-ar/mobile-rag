#!/bin/bash

THIS_FILE=$(realpath "$0")
DIR=$(dirname "$THIS_FILE")

keytool -genkeypair -v -storetype PKCS12 -keystore $DIR/android/keys/my-release-key.jks -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

keytool -genkeypair -v -storetype PKCS12 -keystore $DIR/android/keys/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"

