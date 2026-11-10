import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../src/db/schema.sql', import.meta.url));
const destination = fileURLToPath(new URL('../dist/db/schema.sql', import.meta.url));

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
console.log(`copied ${source} -> ${destination}`);
