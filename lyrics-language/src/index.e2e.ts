import { parsePlainLyrics, printLyrics } from './index.js';

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, '../fixtures/delirio-en-hyrule.txt');
const text = await readFile(path, 'utf-8');
const tree = parsePlainLyrics(text);

console.clear();
console.dir(tree, { depth: 16 });

await writeFile(
    resolve(path, '../delirio-en-hyrule.json'),
    JSON.stringify(tree, null, 4),
    'utf-8'
);

await writeFile(
    resolve(path, '../delirio-en-hyrule.lyrics'),
    printLyrics(tree),
    'utf-8'
);