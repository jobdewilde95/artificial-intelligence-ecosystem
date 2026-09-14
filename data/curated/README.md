# Curated data

These files hold what no API provides: institutional context, policy milestones,
funding, and safety events. They are plain YAML — edit them directly, then run
`npm run refresh` (or just `npm run refresh -- --only=nothing`, which still
recompiles curated data) to fold them into `data/snapshots/curated.json`.

Each file is a flat YAML list. The shapes are defined in `src/types/index.ts`
(`Lab`, `PolicyMilestone`, `FundingRound`, `SafetyEvent`, `AdoptionIndicator`)
and enforced by `npm run validate`.

**Conventions**
- `date` is always `YYYY-MM-DD`. Use the first of the month if only the month is known.
- Every entry should carry a `url` to a primary source where one exists.
- Prefer omission to guesswork. A missing row is better than a wrong one.

This seed set is accurate but deliberately **not exhaustive** — it is a starting
point designed to be extended over time.
