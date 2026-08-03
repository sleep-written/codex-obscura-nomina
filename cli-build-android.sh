cd ./lyrics-language
npm ci
node --run build

cd ../client
npm ci
node --run build

cd ../shell
npm ci
node --run sync

cd android
./gradlew assembleDebug

echo "APK en shell/android/app/build/outputs/apk/debug/app-debug.apk"