import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
const path = process.argv[2];
const digest = createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile(path + '.sha256', `${digest}  ${basename(path)}\n`);
console.log(`${basename(path)}: SHA-256 checksum written`);
