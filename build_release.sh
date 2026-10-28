#!/bin/bash
APPS=("mecfinder_app" "mecfinder_provider_app")

for APP in "${APPS[@]}"; do
  cd /home/anger/Projects/mecfinders/$APP/android/app
  
  if [ ! -f release.keystore ]; then
    keytool -genkey -v -keystore release.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=MecFinder, OU=Development, O=MecFinder, L=City, S=State, C=IN" -storepass mecfinder123 -keypass mecfinder123
  fi

  if ! grep -q "signingConfigs.release" build.gradle; then
    sed -i '/buildTypes {/i \
    signingConfigs {\
        release {\
            storeFile file("release.keystore")\
            storePassword "mecfinder123"\
            keyAlias "my-key-alias"\
            keyPassword "mecfinder123"\
        }\
    }' build.gradle

    sed -i 's/release {/release {\n            signingConfig signingConfigs.release/g' build.gradle
  fi

  cd ../
  ./gradlew assembleRelease
  ./gradlew bundleRelease
done
