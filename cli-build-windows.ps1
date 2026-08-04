$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Shim de `rm` para Windows.
#
# `npm run` / `node --run` lanzan cada script con cmd.exe, no con PowerShell,
# asi que un alias o una funcion definida aqui NO es visible para ellos. Lo que
# si heredan es el PATH del proceso, por lo que se genera un `rm.cmd` en una
# carpeta temporal y se antepone al PATH: cmd.exe resuelve `rm` por nombre y
# delega en una funcion de PowerShell que hace Remove-Item -Recurse -Force.
#
# Esto permite que scripts como "build:clear": "rm -rf ./dist" funcionen sin
# tocar los package.json ni instalar rimraf.
# ---------------------------------------------------------------------------
$shimDir = Join-Path $env:TEMP 'codex-obscura-nomina-shims'
New-Item -ItemType Directory -Force -Path $shimDir | Out-Null

@'
# Emula `rm [-rf] <ruta...>`: ignora los flags estilo POSIX y borra cada ruta.
function Invoke-Rm {
    param([string[]]$Arguments)

    foreach ($path in ($Arguments | Where-Object { $_ -notmatch '^-' })) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Recurse -Force
        }
    }
}

Invoke-Rm -Arguments $args
'@ | Set-Content -Path (Join-Path $shimDir 'rm.ps1') -Encoding utf8

@'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rm.ps1" %*
'@ | Set-Content -Path (Join-Path $shimDir 'rm.cmd') -Encoding ascii

if ($env:PATH -notlike "$shimDir;*") {
    $env:PATH = "$shimDir;$env:PATH"
}

# ---------------------------------------------------------------------------

Set-Location .\lyrics-language
npm ci
node --run build

Set-Location ..\client
npm ci
node --run build

Set-Location ..\shell
npm ci
node --run sync

Set-Location .\electron
npm install
npm run dist
