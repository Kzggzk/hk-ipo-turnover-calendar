# HK IPO Turnover Calendar

Mac-generated, Netlify-hosted static site for Hong Kong IPO cash-turnover planning.

## Local run

```bash
npm run fetch:hkipo
npm run build
open dist/index.html
```

## Production flow

`launchd` runs `scripts/refresh-and-publish.sh` on Hong Kong trading weekdays at 02:00 UTC+8. The script:

1. Fetches and validates sources.
2. Writes `data/latest.json` and `data/history/YYYY-MM-DD.json`.
3. Builds `dist/index.html`.
4. Commits and pushes when a Git remote exists.
5. Leaves the previous site intact if fetching or building fails.

Netlify should be connected to this GitHub repo with `dist/` as the publish directory.
