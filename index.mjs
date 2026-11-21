import { readdir, lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const METRICS = ['raw', 'gzip', 'brotli'];
export function validateBudget(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Budget must be an object');
  for (const key of Object.keys(input)) if (!['total', 'perFile', 'extensions', 'maxFiles', 'maxFileBytes'].includes(key)) throw new Error(`Unknown budget key: ${key}`);
  const limits = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Limits must be an object');
    for (const [metric, bytes] of Object.entries(value)) {
      if (!METRICS.includes(metric) || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Use non-negative integer byte limits for raw, gzip or brotli');
    }
    return value;
  };
  const result = { total: {}, perFile: {}, extensions: null, maxFiles: 5000, maxFileBytes: 25 * 1024 * 1024, ...input };
  limits(result.total); limits(result.perFile);
  if (result.extensions !== null && (!Array.isArray(result.extensions) || !result.extensions.length || result.extensions.some(e => typeof e !== 'string' || !/^\.[a-z0-9]+$/i.test(e)))) throw new Error('extensions must be a non-empty array such as [".js", ".css"]');
  for (const key of ['maxFiles', 'maxFileBytes']) if (!Number.isSafeInteger(result[key]) || result[key] < 1) throw new Error(`${key} must be a positive integer`);
  return result;
}

export async function measureDirectory(directory, budget = {}) {
  const config = validateBudget(budget);
  const root = path.resolve(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error('Build path must be a real directory, not a symlink');
  const files = [], skipped = [], checks = [];
  const totals = { raw: 0, gzip: 0, brotli: 0 };
  let visited = 0;
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      if (++visited > config.maxFiles) throw new Error(`Traversal exceeds maxFiles (${config.maxFiles}); narrow the build directory`);
      const full = path.join(dir, entry.name), relative = path.relative(root, full).split(path.sep).join('/');
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) { skipped.push({ file: relative, reason: 'symlink' }); continue; }
      if (stat.isDirectory()) { await walk(full); continue; }
      if (!stat.isFile()) { skipped.push({ file: relative, reason: 'not a regular file' }); continue; }
      if (config.extensions && !config.extensions.includes(path.extname(entry.name).toLowerCase())) continue;
      if (stat.size > config.maxFileBytes) throw new Error(`${relative} exceeds maxFileBytes (${config.maxFileBytes}); increase the cap explicitly`);
      const data = await readFile(full);
      if (data.length > config.maxFileBytes) throw new Error(`${relative} grew beyond maxFileBytes`);
      const after = await lstat(full);
      if (after.mtimeMs !== stat.mtimeMs || after.size !== stat.size) throw new Error(`${relative} changed during measurement; run against a completed build`);
      const size = { raw: data.length, gzip: gzipSync(data, { level: 9 }).length, brotli: brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } }).length };
      files.push({ file: relative, ...size });
      for (const metric of METRICS) totals[metric] += size[metric];
      for (const [metric, limit] of Object.entries(config.perFile)) checks.push({ id: `file.${relative}.${metric}`, status: size[metric] <= limit ? 'pass' : 'fail', message: `${relative}: ${size[metric]} bytes ${metric}; budget ${limit} bytes.` });
    }
  }
  await walk(root);
  for (const [metric, limit] of Object.entries(config.total)) checks.push({ id: `total.${metric}`, status: totals[metric] <= limit ? 'pass' : 'fail', message: `${totals[metric]} bytes ${metric}; total budget ${limit} bytes.` });
  if (!files.length) checks.push({ id: 'files.empty', status: 'fail', message: 'No matching build files found. Check the build path and extension filter.' });
  if (!Object.keys(config.total).length && !Object.keys(config.perFile).length) checks.push({ id: 'budget.missing', status: 'warn', message: 'Measurement only: no budgets configured. Add explicit byte limits to enforce a gate.' });
  if (skipped.length) checks.push({ id: 'files.skipped', status: 'warn', message: `${skipped.length} non-regular file(s) or symlinks were skipped.` });
  return { schemaVersion: 1, tool: 'Asset Budget', summary: `${files.length} file(s) measured; ${totals.raw} raw bytes. Compression totals sum independently compressed files; they are not browser timing measurements.`, checks, totals, largest: [...files].sort((a,b) => b.raw - a.raw).slice(0, 10), files, skipped };
}
