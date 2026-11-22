import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demo = fileURLToPath(new URL('./demo.mjs', import.meta.url));
function runDemo(format) {
  const result = spawnSync(process.execPath, [demo, format], { encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  return result.stdout;
}

test('documented demo produces a labeled, successful structured report', () => {
  const report = JSON.parse(runDemo('json'));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.tool, 'Asset Budget');
  assert.match(report.summary, /SYNTHETIC FIXTURE DEMO/);
  assert.ok(report.checks.length > 0);
  assert.ok(report.checks.every(check => check.status === 'pass'));
  assert.equal(report.files.length, 2);
  assert.equal(report.totals.raw, report.files.reduce((sum, file) => sum + file.raw, 0));
  assert.ok(report.totals.gzip > 0 && report.totals.brotli > 0);
});

test('documented HTML demo is standalone and clearly synthetic', () => {
  const html = runDemo('html');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /SYNTHETIC FIXTURE DEMO/);
  assert.match(html, /Asset Budget/);
  assert.doesNotMatch(html, /<(?:script|iframe|link)\b[^>]*(?:src|href)=["']https?:/i);
});

test('documented terminal demo finishes without a configured live service', () => {
  assert.match(runDemo('text'), /SYNTHETIC FIXTURE DEMO/);
});
