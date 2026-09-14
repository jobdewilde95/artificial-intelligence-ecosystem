# AI Ecosystem Observatory

A living dashboard tracking the development of the artificial intelligence
ecosystem, under a deliberately broad definition: capability and compute, the
capital behind them, the open-source commons, the research record, and the
policy, safety and adoption consequences.

Every figure names its source and its age. Where a source is unreachable, the
dashboard says so rather than quietly serving stale numbers as current.

**Live site:** https://jobdewilde95.github.io/artificial-intelligence-ecosystem

---

## Quick start

```bash
npm install
npm run refresh     # pull every source into data/snapshots/
npm run dev         # http://localhost:5173/artificial-intelligence-ecosystem/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run refresh` | Run every collector |
| `npm run refresh -- --only=policy` | Run one collector |
| `npm run validate` | Schema-check everything under `data/` |
| `npm run build` | Typecheck, build, and emit the Pages SPA fallback |

## The eight pillars

| Pillar | Question it answers | Principal source |
| --- | --- | --- |
| Capability & Models | How fast is capability advancing, and who produces it? | Epoch AI notable models |
| Compute & Infrastructure | Where is the world's AI compute, and who controls it? | Epoch AI supercomputers |
| Capital & Industry | What is invested, and what does intelligence cost? | OpenRouter + curated funding |
| Open Source & Developers | How much of the stack is open? | GitHub + Hugging Face Hub |
| Research | How much research is produced, and at what rate? | Crossref (+ arXiv when reachable) |
| Policy & Governance | How is AI actually regulated, and where? | Federal Register + curated timeline |
| Safety & Risk | What went wrong, and what is being done? | Curated |
| Adoption & Impact | Who uses this, and what changed? | Curated + Hacker News |

## How updating works

Four mechanisms, each doing a different job.

1. **Scheduled** — `.github/workflows/refresh.yml` runs daily at 06:00 UTC,
   commits changed data, and redeploys.
2. **Manual** — `npm run refresh` locally, or the *Refresh data* workflow's
   `workflow_dispatch` (it accepts a single source id).
3. **Curated** — YAML in `data/curated/` for what no API provides. Edit and
   re-run `npm run refresh`; `npm run validate` enforces the shapes.
4. **Live** — a few values re-fetch in the browser from the five APIs that send
   CORS headers. It never blocks rendering, fails silently, and can be toggled
   off in the header.

> **A deliberate CI detail.** A commit pushed with the default `GITHUB_TOKEN`
> does not trigger other workflows. So `refresh.yml` *calls* `deploy.yml` as a
> reusable workflow instead of relying on the push event — otherwise the cron
> would update the data and never redeploy the site. No PAT required.

## Repository layout

```
src/
  pages/        Overview + 8 pillar pages + method page
  components/   Figure (chart + table view), MetricTile, DataHealth, Panel
  lib/          data loading, live-fetch layer, theme tokens, formatters
  types/        shared with the collectors — one source of truth
scripts/
  collect/
    framework.ts    retry, time budgets, stale fallback, history
    registry.ts     auto-discovery
    sources/*.ts    one file per source
  validate.ts       schema checks
data/
  snapshots/*.json       current state (committed)
  history/metrics.ndjson append-only time series (committed)
  curated/*.yaml         hand-maintained context
```

## Adding a data source

Drop a file into `scripts/collect/sources/`. The registry discovers it — there
is no list to update.

```ts
import { defineSource } from '../framework.js';

export default defineSource<MyData>({
  id: 'my-source',
  label: 'Something worth tracking',
  pillar: 'capability',
  cadence: 'daily',
  attribution: { name: 'Upstream', url: 'https://example.org' },
  timeBudgetMs: 120_000,        // optional ceiling for slow upstreams
  empty: { rows: [] },           // served if it has never succeeded
  async collect(ctx) {
    const body = await ctx.getJson<Payload>('https://example.org/api');
    ctx.metric('capability.something', body.rows.length, 'rows');
    return { rows: body.rows };
  },
  count: (d) => d.rows.length,
});
```

`ctx.getJson` / `getText` / `get` retry with exponential backoff on 429 and 5xx
and fail fast on every other 4xx. Pass `{ attempts: 1 }` for optional
enrichment that should never hold up a run.

## Design notes

- **Failure is a first-class state.** Each collector is independent and
  time-budgeted. A failure keeps the previous snapshot, marks it `stale`, and
  records the real `lastSuccess`. The build never fails because an upstream is
  down, and the Data Health panel shows per-source freshness.
- **History accrues.** Every run appends to `data/history/metrics.ndjson`, so
  the tracker gets more useful the longer it runs.
- **Charts follow a validated palette.** Colours were checked with a
  colour-vision-deficiency validator in both light and dark mode. Scatter plots
  cap at three series because that is what validates when every colour pair is
  on screen at once. Every figure ships a table view.

## Known limits

Read `/about` on the site for the full list. In short: disclosure bias means
every compute and capacity total is a floor; recent periods are undercounted
because indexing and disclosure lag; keyword matching measures attention, not
quality; and the curated files are a documented seed, not a survey.

## Deployment

One repository setting is still required:

**Settings → Pages → Source: GitHub Actions**

Until that is set, the workflows run and the build succeeds, but there is
nowhere to publish to.

The deploy workflow builds on a push to the repository's **default branch**,
whatever it is named — it reads `github.event.repository.default_branch`
rather than assuming `main`, and the refresh job pushes back to the branch it
ran on. So the pipeline works whether the default stays as-is or the work is
later merged into `main`.

## Data sources & licences

Epoch AI datasets are CC BY 4.0. Hugging Face, OpenRouter, GitHub, Crossref,
the Federal Register and Hacker News are used through their public APIs. This
project aggregates and links; it does not redistribute source datasets beyond
the derived figures shown.
