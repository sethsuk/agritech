# User manuals

| PDF | For | Language |
|---|---|---|
| `out/worker-manual-th.pdf` | Workers | Thai |
| `out/worker-manual-my.pdf` | Workers | Burmese |
| `out/manager-manual-th.pdf` | Managers and the owner | Thai |

Text lives in `content/worker.ts` (Thai and Burmese side by side) and `content/manager.ts`.
Button and screen labels are pulled from `lib/i18n/dictionary.ts`, so they always match the app.

## Regenerate after the app changes

```bash
npm run build
LOG_TOKEN_SECRET=<any 32+ chars> SKIP_VALIDATION=true npx next start -p 3000   # leave running

npx tsx docs/manuals/capture.ts        # screenshots (or: th | my | manager)
npx tsx docs/manuals/build.ts          # PDFs → docs/manuals/out/
```

Use a production build, not `npm run dev`: in dev, React Strict Mode stops the QR camera
from starting.

`capture.ts` writes demo data to the shared dev database (trees `ZL1-1`…, accounts
`e2e_manual_*` and `minzaw`) and deletes exactly those afterwards. `build.ts` warns when a
screenshot or a numbered marker is missing.
