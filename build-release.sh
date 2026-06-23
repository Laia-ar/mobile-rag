#!/bin/bash

# build aar for google play store
#npx react-native build-android --mode=release
set -e
# build universal apk
npm run android -- --mode="release"

find android/ -name "*.apk" | xargs ls -lah

