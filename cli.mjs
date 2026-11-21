#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { measureDirectory } from './index.mjs';
import { options, formatReport, exitCode, clean } from './support.mjs';
try {
  const args = options({ config: { type: 'string' }, strict: { type: 'boolean' } });
  if (args.help) console.log('Asset Budget\n\nnode cli.mjs <build-directory> [--config budget.json]\n  [--format text|json|markdown|html] [--strict]\n\nLimits are integer bytes. No dependencies. No network access.');
  else {
    if (args.positionals.length !== 1) throw new Error('Provide exactly one build directory');
    const budget = args.config ? JSON.parse(await readFile(args.config, 'utf8')) : {};
    const report = await measureDirectory(args.positionals[0], budget);
    console.log(formatReport(report, args.format));
    process.exitCode = exitCode(report, args.strict);
  }
} catch (error) { console.error(`Asset Budget: ${clean(error.message)}`); process.exitCode = 2; }
