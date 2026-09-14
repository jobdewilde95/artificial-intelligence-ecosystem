import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { loadDataset, type Dataset } from '@/lib/data';
import { useTheme, useTokens } from '@/lib/theme';
import { useLiveValues } from '@/lib/live';
import { PILLARS } from '@/lib/pillars';
import { relativeTime } from '@/lib/format';
import Overview from '@/pages/Overview';
import Capability from '@/pages/Capability';
import Compute from '@/pages/Compute';
import Capital from '@/pages/Capital';
import OpenSource from '@/pages/OpenSource';
import Research from '@/pages/Research';
import Policy from '@/pages/Policy';
import Safety from '@/pages/Safety';
import Adoption from '@/pages/Adoption';
import About from '@/pages/About';
import NotFound from '@/pages/NotFound';

const LIVE_KEY = 'aieo-live';

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const tokens = useTokens();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  const [liveEnabled, setLiveEnabled] = useState(() => {
    try {
      return localStorage.getItem(LIVE_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const { live, loading: liveLoading } = useLiveValues(liveEnabled);

  useEffect(() => {
    loadDataset()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(LIVE_KEY, liveEnabled ? 'on' : 'off');
    } catch {
      // Preference persistence is optional.
    }
  }, [liveEnabled]);

  const lastRun = useMemo(() => {
    if (!data?.health.length) return null;
    return data.health.map((h) => h.fetchedAt).sort().at(-1) ?? null;
  }, [data]);

  const degraded = data?.health.filter((h) => h.status !== 'ok').length ?? 0;

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-lg font-semibold text-ink">Could not load the dataset</h1>
        <p className="mt-2 text-sm text-ink-secondary">{error}</p>
        <p className="mt-4 text-sm text-ink-muted">
          Run <code className="rounded bg-raised px-1">npm run refresh</code> to generate the data files.
        </p>
      </main>
    );
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded px-2.5 py-1.5 text-sm transition-colors ${
      isActive ? 'bg-raised font-medium text-ink' : 'text-ink-secondary hover:text-ink'
    }`;

  return (
    <div className="min-h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-hairline bg-plane/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-controls="pillar-nav"
            className="rounded border border-hairline px-2 py-1 text-xs text-ink-secondary lg:hidden"
          >
            Menu
          </button>

          <NavLink to="/" className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="h-4 w-4 shrink-0 rounded-sm" style={{ background: tokens?.series[0] ?? '#3987e5' }} />
            <span className="truncate text-sm font-semibold tracking-tight text-ink">AI Ecosystem Observatory</span>
          </NavLink>

          <div className="ml-auto flex items-center gap-2 text-xs">
            {lastRun && (
              <span className="hidden text-ink-muted sm:inline" title={lastRun}>
                data {relativeTime(lastRun)}
              </span>
            )}
            {degraded > 0 && (
              <NavLink to="/about" className="hidden items-center gap-1 text-ink-secondary hover:text-ink sm:flex">
                <span aria-hidden style={{ color: 'var(--status-warning)' }}>▲</span>
                {degraded} degraded
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => setLiveEnabled((v) => !v)}
              aria-pressed={liveEnabled}
              title={liveEnabled ? 'Live refresh on: some values re-fetch in your browser' : 'Live refresh off: showing committed snapshot values only'}
              className="rounded border border-hairline px-2 py-1 text-ink-secondary transition-colors hover:text-ink"
            >
              <span aria-hidden className="mr-1" style={{ color: liveEnabled ? 'var(--status-good)' : 'var(--text-muted)' }}>
                {liveLoading ? '◐' : '●'}
              </span>
              Live {liveEnabled ? 'on' : 'off'}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded border border-hairline px-2 py-1 text-ink-secondary transition-colors hover:text-ink"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-5">
        <nav
          id="pillar-nav"
          aria-label="Pillars"
          className={`${navOpen ? 'block' : 'hidden'} w-full shrink-0 lg:block lg:w-52`}
        >
          <div className="lg:sticky lg:top-16 space-y-4">
            <div>
              <NavLink to="/" end className={navLinkClass}>Overview</NavLink>
            </div>
            <div>
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted">Pillars</p>
              <ul className="space-y-0.5">
                {PILLARS.map((p) => (
                  <li key={p.id}>
                    <NavLink to={p.path} className={navLinkClass}>
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tokens?.series[p.slot] }} />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-hairline pt-3">
              <NavLink to="/about" className={navLinkClass}>Method & data health</NavLink>
            </div>
          </div>
        </nav>

        <main id="main" className={`${navOpen ? 'hidden' : 'block'} min-w-0 flex-1 lg:block`}>
          {!data ? (
            <div className="py-20 text-center text-sm text-ink-muted">Loading dataset…</div>
          ) : (
            <Routes>
              <Route path="/" element={<Overview data={data} live={live} liveEnabled={liveEnabled} />} />
              <Route path="/capability" element={<Capability data={data} />} />
              <Route path="/compute" element={<Compute data={data} />} />
              <Route path="/capital" element={<Capital data={data} live={live} liveEnabled={liveEnabled} />} />
              <Route path="/open-source" element={<OpenSource data={data} />} />
              <Route path="/research" element={<Research data={data} />} />
              <Route path="/policy" element={<Policy data={data} />} />
              <Route path="/safety" element={<Safety data={data} />} />
              <Route path="/adoption" element={<Adoption data={data} />} />
              <Route path="/about" element={<About data={data} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </main>
      </div>

      <footer className="mx-auto max-w-[1400px] px-4 py-8 text-[11px] leading-relaxed text-ink-muted">
        <p>
          Aggregated from public sources. Every figure links to its origin — check the source line before citing anything here.
          Built as an open, updatable tracker; data refreshes on a schedule and the curated layer is edited by hand.
        </p>
      </footer>
    </div>
  );
}
