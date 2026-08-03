# Toolchain para compilar

Nada de esto necesita root ni Android Studio. Se instala bajo `~/toolchain/` y
se puede borrar entero para empezar de cero.

## Android (en WSL)

El proyecto generado por Capacitor 8 pide **JDK 21**, `compileSdk 36`,
AGP 8.13.0 y Gradle 8.14.3 (este último lo baja solo el wrapper).

```bash
mkdir -p ~/toolchain && cd ~/toolchain

# JDK 21 (Temurin)
curl -fsSL -o jdk21.tar.gz \
  "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
tar xzf jdk21.tar.gz
export JAVA_HOME=$(find ~/toolchain -maxdepth 1 -name 'jdk-21*' -type d | head -1)

# Android cmdline-tools
curl -fsSL -o cmdline-tools.zip \
  "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
mkdir -p ~/toolchain/android-sdk/cmdline-tools
cd ~/toolchain/android-sdk/cmdline-tools
"$JAVA_HOME/bin/jar" xf ~/toolchain/cmdline-tools.zip   # no hace falta unzip
mv cmdline-tools latest
chmod +x latest/bin/*

export ANDROID_HOME=~/toolchain/android-sdk
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  --sdk_root="$ANDROID_HOME" --licenses
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

Para dejarlo permanente, en `~/.zshrc`:

```bash
export JAVA_HOME="$HOME/toolchain/jdk-21.0.12+8"
export ANDROID_HOME="$HOME/toolchain/android-sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Y en `shell/android/local.properties` (ignorado por git, hay que recrearlo tras
un clon nuevo):

```properties
sdk.dir=/home/<usuario>/toolchain/android-sdk
```

### Compilar

```bash
cd shell
npm run sync
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Para un APK de release hace falta un keystore propio y un `signingConfig` en
`android/app/build.gradle`; sin eso `cap build android` no firma nada instalable.

### Dispositivo físico desde WSL

WSL2 no ve el USB directamente. Dos vías:

- **Depuración inalámbrica** (más simple): en el móvil, Opciones de
  desarrollador → Depuración inalámbrica → Vincular con código.
  ```bash
  adb pair <ip>:<puerto-de-vinculacion>
  adb connect <ip>:<puerto-de-depuracion>
  ```
- **usbipd-win**: `usbipd bind`/`attach` desde PowerShell como administrador.

Con el dispositivo visible en `adb devices`, `npm run android:run` lo detecta.

## Windows (en Windows)

Solo Node 22+. Las dependencias de Electron se instalan dentro de
`shell\electron\`; ver el README para el flujo.

Electron 43 ya **no** usa `postinstall` propio del paquete para bajar el
binario: expone un bin `install-electron`. En `shell/electron/package.json` está
cableado como `postinstall` del subproyecto, así que un `npm install` normal lo
resuelve.
