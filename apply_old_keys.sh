#!/bin/bash
set -e

# --- 1. Customer App (mecfinder_app) ---
echo "Configuring Customer App..."
cp ./OLD_APP/android_user_app/app/mecfinder-release.keystore ./mecfinder_app/android/app/
cd ./mecfinder_app/android/app/
sed -i 's/release.keystore/mecfinder-release.keystore/g' build.gradle
sed -i 's/my-key-alias/mecfinder/g' build.gradle
sed -i 's/mecfinder123/MecFinder@2026/g' build.gradle
cd ../
./gradlew bundleRelease
cd ../../


# --- 2. Provider App (mecfinder_provider_app) ---
echo "Configuring Provider App..."
cp ./OLD_APP/android_provider_app/app/mechanic-release.keystore ./mecfinder_provider_app/android/app/
cd ./mecfinder_provider_app/android/app/
sed -i 's/release.keystore/mechanic-release.keystore/g' build.gradle
sed -i 's/my-key-alias/mechanic/g' build.gradle
sed -i 's/mecfinder123/MecFinder@2026/g' build.gradle
cd ../
./gradlew bundleRelease
cd ../../

echo "DONE!"
