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
