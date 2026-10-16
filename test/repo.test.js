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

test('src/core and src/fx stay pure: no window, document, Math.random or Date.now', () => {
  const banned = [/\bwindow\b/, /\bdocument\b/, /Math\.random/, /Date\.now/];
  for (const dir of ['core', 'fx']) {
    for (const f of walk(join(root, 'src', dir))) {
      const text = readFileSync(f, 'utf8');
      for (const re of banned) assert.ok(!re.test(text), `${f} matches ${re}`);
    }
  }
});

// index.html may name its own public address in metadata the browser never fetches: name/property
// <meta> tags, rel="canonical" and the JSON-LD block. Any other external URL would be a request.
const INERT = [
  /<meta (?:name|property)="[^"]*" content="[^"]*">/g,
  /<link rel="canonical" href="[^"]*">/g,
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
];

test('index.html and src contain no external URLs', () => {
  const files = [...walk(join(root, 'src')), join(root, 'index.html')];
  for (const f of files) {
    let text = readFileSync(f, 'utf8');
    if (f.endsWith('index.html')) for (const re of INERT) text = text.replace(re, '');
    for (const s of SCHEME) assert.ok(!text.includes(s), `${f} contains ${s}`);
  }
});
