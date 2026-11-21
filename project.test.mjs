import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { measureDirectory, validateBudget } from './index.mjs';
async function fixture(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'asset-budget-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
test('measures nested files with actual compression', async t => {
  const root = await fixture(t); await mkdir(path.join(root, 'assets')); await writeFile(path.join(root, 'assets', 'app.js'), 'x'.repeat(1000));
  const report = await measureDirectory(root, { total: { raw: 1000 } });
  assert.equal(report.totals.raw, 1000); assert.ok(report.totals.gzip < 1000); assert.ok(report.totals.brotli < 1000);
  assert.equal(report.files[0].file, 'assets/app.js'); assert.equal(report.checks[0].status, 'pass');
});
test('fails exact configured per-file and total budgets', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'a.js'), 'hello');
  const report = await measureDirectory(root, { total: { raw: 4 }, perFile: { raw: 4 } });
  assert.equal(report.checks.filter(c => c.status === 'fail').length, 2);
});
test('filters build extensions and does not count ignored files', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'a.js'), 'a'); await writeFile(path.join(root, 'large.map'), 'a'.repeat(100));
  assert.equal((await measureDirectory(root, { extensions: ['.js'] })).totals.raw, 1);
});
test('an empty directory cannot silently pass the gate', async t => {
  const report = await measureDirectory(await fixture(t), { total: { raw: 100 } }); assert.ok(report.checks.some(c => c.status === 'fail'));
});
test('rejects invalid budgets, typos and unsupported units', () => {
  for (const b of [{ total: { raw: -1 } }, { total: { gzipp: 1 } }, { perFile: { raw: '10KB' } }, { total: [] }, { unknown: 1 }, { extensions: [] }]) assert.throws(() => validateBudget(b));
});
test('caps prevent accidental measurement of huge trees or files', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'a.js'), 'ab');
  await assert.rejects(measureDirectory(root, { maxFileBytes: 1 }), /maxFileBytes/);
  await writeFile(path.join(root, 'b.js'), 'a'); await assert.rejects(measureDirectory(root, { maxFiles: 1 }), /maxFiles/);
});
test('measurement without a budget reports a warning', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'a.js'), 'a');
  assert.ok((await measureDirectory(root)).checks.some(c => c.id === 'budget.missing'));
});
test('symlinks cannot pull external files into the report', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'a.js'), 'a'); await symlink(path.join(root, 'a.js'), path.join(root, 'linked.js'));
  const report = await measureDirectory(root); assert.equal(report.files.length, 1); assert.equal(report.skipped[0].reason, 'symlink');
});
