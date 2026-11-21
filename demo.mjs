import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import { measureDirectory } from './index.mjs';import { formatReport } from './support.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'asset-budget-demo-'));
try {await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'assets','app.js'),'const demo = "synthetic fixture";\n'.repeat(100));await writeFile(path.join(root,'index.html'),'<main>Synthetic fixture demo</main>');const report=await measureDirectory(root,{total:{raw:10000,gzip:1000,brotli:1000},perFile:{raw:5000}});report.summary='SYNTHETIC FIXTURE DEMO. '+report.summary;console.log(formatReport(report,process.argv[2]??'text'));}
finally {await rm(root,{recursive:true,force:true});}
