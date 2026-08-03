// Equivalente de `cap sync` para Electron: copia el build `native` del cliente
// dentro del proyecto de Electron, para que quede autocontenido y se pueda
// empaquetar desde Windows sin depender de rutas de WSL.
import { cp, rm, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../client/dist/native/browser');
const target = resolve(here, '../electron/app');

try {
  await access(source);
} catch {
  console.error(
    `No existe el build nativo en ${source}.\n` +
      `Ejecuta primero: npm --prefix ../client run build:native`
  );
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`Copiado el build web a ${target}`);
