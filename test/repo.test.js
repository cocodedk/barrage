import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SCHEME = ['http', 'https'].map((s) => `${s}://`);

function walk(path, out = []) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
  } else {
    out.push(path);
  }
  return out;
}

const checked = [...walk(join(root, 'src')), ...walk(join(root, 'test')), join(root, 'index.html')];

test('every file in src, test and index.html is under 200 lines', () => {
  for (const f of checked) {
    const lines = readFileSync(f, 'utf8').split('\n').length;
    assert.ok(lines < 200, `${f} has ${lines} lines`);
  }
});

test('index.html and src contain no external URLs', () => {
  const files = [...walk(join(root, 'src')), join(root, 'index.html')];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const s of SCHEME) assert.ok(!text.includes(s), `${f} contains ${s}`);
  }
});
