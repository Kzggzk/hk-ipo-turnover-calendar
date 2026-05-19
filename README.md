# HK IPO Turnover Calendar

Mac-generated, Netlify-hosted static site for Hong Kong IPO cash-turnover planning.

## Live endpoints

- Public site: https://hk-ipo-turnover-calendar.netlify.app/
- GitHub repo: https://github.com/Kzggzk/hk-ipo-turnover-calendar
- Netlify project: https://app.netlify.com/projects/hk-ipo-turnover-calendar

## Local run

```bash
npm run fetch:hkipo
npm run build
open dist/index.html
```

## Production flow

`launchd` triggers `scripts/refresh-and-publish.sh` daily at 12:00 UTC+8; the script skips weekends and Hong Kong public holidays before touching data. The script:

1. Skips weekends and Hong Kong public holidays before touching data.
2. Fetches and validates sources.
3. Writes `data/latest.json` and `data/history/YYYY-MM-DD.json`.
4. Builds `dist/index.html`.
5. Commits and pushes when a Git remote exists, so Netlify can redeploy even when only the right-top `updated at` timestamp changes.
6. Leaves the previous site intact if fetching or building fails.

The holiday guard currently uses the gazetted 2026 GovHK holiday list:
https://www.gov.hk/en/about/abouthk/holiday/2026.htm

Netlify should be connected to this GitHub repo with `dist/` as the publish directory. The local Mac refresh and GitHub push path is already active; Netlify Git-based deploy still needs the one-time repo binding in the Netlify dashboard if the site was created by direct deploy first.
