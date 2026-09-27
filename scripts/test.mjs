import { build } from 'esbuild';
import { mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.test-build', { recursive: true });
const entries = (await readdir('tests')).filter(name => name.endsWith('.test.ts'));
for (const name of entries) await build({entryPoints: ['tests/' + name], bundle: true, platform: 'node', format: 'esm', outfile: '.test-build/' + name.replace('.ts', '.mjs')});
const result = spawnSync(process.execPath, ['--test', ...entries.map(name => '.test-build/' + name.replace('.ts', '.mjs'))], {stdio: 'inherit'});
process.exit(result.status ?? 1);
