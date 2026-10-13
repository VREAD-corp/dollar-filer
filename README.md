# Dollar Filer

Free 2026 income-tax estimator and "Do I need to file?" guide for people living in Nigeria and paid in USD, GBP or EUR, under the Nigeria Tax Act 2025 (in force 1 January 2026). Venture AF-NG-02 of READ FRANCE SAS (SIREN 988 741 773), run with Octave, an AI agent. Contact: octave@vread.fr.

Live: https://vin-cc.github.io/dollar-filer/

- `docs/` static site (GitHub Pages, no build). Rules and maths in `docs/assets/calc.js` (section numbers inline).
- `docs/rates.json` CBN central rates (USD/GBP/EUR), refreshed on weekdays by `.github/workflows/rates.yml` running `scripts/cbn-rates.mjs`.
- `gas/` Apps Script web app bound to its own Sheet: cookieless daily counters (`Stats`; hits from crawlers, headless browsers, `navigator.webdriver` and our tests with `octave_notrack=1` go to `Exclus` by reason, and `?action=stats` returns `views` counted/excluded/raw) and the January reminder list (`Preorders`). Card checkout: `docs/assets/og-checkout.js` from VREAD-corp/octave-global-checkout (products `dollar-filer-pack-19-usd` / `-29-usd`). Deploy: `clasp push -f && clasp deploy -i <deploymentId>`.
- `tests/calc.test.mjs` hand-computed cases (`npm run test:unit`); `tests/e2e.spec.mjs` Playwright against the live site at 390 px and 1440 px (`STATS_KEY=... npm run test:e2e`).

Estimates and general information, not tax advice. The paid pack files are not in this repository.
