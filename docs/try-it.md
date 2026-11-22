# Try Asset Budget without production data

Requires Node.js 22 or later; no dependency installation is needed.

```sh
git clone https://github.com/anistack72/asset-budget.git
cd asset-budget
node demo.mjs
node demo.mjs json > demo-report.json
node demo.mjs html > demo-report.html
```

The demo creates a temporary two-file build, measures raw/gzip/Brotli bytes, checks its budgets and removes the directory afterwards. No existing build or network service is needed.

All demo output is labeled **SYNTHETIC FIXTURE DEMO**. It demonstrates the reporting path, not measured production adoption or a benchmark. Review the JSON `checks` list; demo checks should have `status: "pass"`. Open `demo-report.html` locally to inspect the standalone HTML report.

## Verify the same onboarding path

```sh
npm run check
npm test
```

`demo.test.mjs` executes the actual CLI demonstration in terminal, JSON and HTML formats. It checks that the fixture succeeds, that the JSON contract is parseable and that the HTML needs no remote script, stylesheet or iframe. Those tests also run in the existing Node 22/24 CI matrix on Linux, macOS and Windows.

For real inputs, return to the [README](../README.md) and its documented scope and limitations. Share a reproducible issue when behavior differs; omit credentials and private data.
