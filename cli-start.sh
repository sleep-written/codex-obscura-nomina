cd ./lyrics-language
npm ci
node --run build

cd ../client
npm ci
node --run start -- $@