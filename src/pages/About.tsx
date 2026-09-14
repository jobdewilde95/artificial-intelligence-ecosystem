import type { Dataset } from '@/lib/data';
import { DataHealth } from '@/components/DataHealth';
import { PageHeader, Panel } from '@/components/Panel';
import { integer, relativeTime, shortDate } from '@/lib/format';

export default function About({ data }: { data: Dataset }) {
  const lastRun = data.health.map((h) => h.fetchedAt).sort().at(-1) ?? null;
  const metrics = new Set(data.history.map((p) => p.metric));

  return (
    <div>
      <PageHeader
        eyebrow="Method"
        title="How this is built, and how far to trust it"
        lede="Every number here comes from a named public source, on a stated date, collected by code you can read. This page exists so that the dashboard's limits are as visible as its findings."
      />

      <div className="space-y-5">
        <Panel title="Data health" subtitle={lastRun ? `Last collector run ${relativeTime(lastRun)} · ${shortDate(lastRun)}` : 'No run recorded'}>
          <DataHealth health={data.health} />
        </Panel>

        <Panel title="How updating works" subtitle="Four mechanisms, each doing a different job">
          <dl className="space-y-3 text-xs leading-relaxed text-ink-secondary">
            <div>
              <dt className="font-medium text-ink">Scheduled refresh</dt>
              <dd>A GitHub Actions job runs every collector daily, commits whatever changed, and redeploys the site. Because the commit is made with the default token — which by design does not trigger other workflows — the refresh job calls the deploy workflow directly rather than relying on the push event.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Manual refresh</dt>
              <dd><code className="rounded bg-raised px-1">npm run refresh</code> runs everything locally; <code className="rounded bg-raised px-1">npm run refresh -- --only=policy</code> runs one source. The same job can be triggered from the Actions tab.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Curated files</dt>
              <dd>Policy milestones, funding rounds, safety events, lab profiles and adoption indicators live as YAML in <code className="rounded bg-raised px-1">data/curated/</code>. No API provides these; they are edited by hand and validated on every build.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Live values</dt>
              <dd>A few figures re-fetch in your browser from the five APIs that permit cross-origin requests — OpenRouter, Hugging Face, the Federal Register, Crossref and Hacker News. Anything marked “Live” was fetched just now. The layer fails silently and falls back to the committed snapshot, and you can switch it off in the header.</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Known limits" subtitle="The things most likely to mislead you">
          <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-ink-secondary">
            <li><strong className="text-ink">Disclosure bias runs through everything.</strong> Cluster capacity, training compute and training cost are only known where someone published or credibly estimated them. Every such total is a floor, never a census.</li>
            <li><strong className="text-ink">Recent periods are undercounted.</strong> Research indexing lags publication by months, Epoch researches compute estimates after release, and clusters are disclosed late. The most recent bar on any time series will almost always rise later.</li>
            <li><strong className="text-ink">Keyword matching is not classification.</strong> Research counts and the Hacker News share are term matches. They measure attention and volume, not quality or genuine relevance.</li>
            <li><strong className="text-ink">The federal policy count is filtered, not raw.</strong> The Federal Register's search matches full document text and returns many incidental mentions, so a relevance gate is applied. The unfiltered mention count is charted alongside it rather than hidden.</li>
            <li><strong className="text-ink">Curated data is a seed, not a survey.</strong> The funding, policy, safety and adoption files cover the largest well-documented cases. They are designed to be extended, and should not be read as complete.</li>
            <li><strong className="text-ink">US policy is over-represented.</strong> The one machine-readable government source here is the US Federal Register. The global timeline is curated to compensate, but coverage outside the US and EU remains thin.</li>
          </ul>
        </Panel>

        <Panel title="Time series" subtitle={`${integer(data.history.length)} metric points across ${metrics.size} tracked metrics`}>
          <p className="mb-3 text-xs leading-relaxed text-ink-secondary">
            Every refresh appends a row per metric to <code className="rounded bg-raised px-1">data/history/metrics.ndjson</code>. Snapshots
            show the present; this file accumulates the past, so the longer the tracker runs the more of the ecosystem's
            movement it can show. It starts sparse by construction.
          </p>
          <ul className="grid gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-2">
            {[...metrics].sort().map((m) => (
              <li key={m} className="truncate"><code>{m}</code></li>
            ))}
          </ul>
        </Panel>

        <Panel title="Adding a source" subtitle="The tracker is meant to grow">
          <p className="text-xs leading-relaxed text-ink-secondary">
            Drop a file into <code className="rounded bg-raised px-1">scripts/collect/sources/</code> that default-exports a{' '}
            <code className="rounded bg-raised px-1">defineSource(...)</code> object with an <code className="rounded bg-raised px-1">id</code>,
            a <code className="rounded bg-raised px-1">pillar</code>, an <code className="rounded bg-raised px-1">empty</code> shape, a{' '}
            <code className="rounded bg-raised px-1">collect()</code> function and a <code className="rounded bg-raised px-1">count()</code>.
            The registry discovers it automatically — there is no list to update. Give it a{' '}
            <code className="rounded bg-raised px-1">timeBudgetMs</code> if the upstream is slow or rate-limited; the runner
            enforces it and falls back to the previous snapshot rather than hanging the build.
          </p>
        </Panel>
      </div>
    </div>
  );
}
