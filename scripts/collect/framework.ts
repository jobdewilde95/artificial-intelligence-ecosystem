import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PillarId, Snapshot, SourceStatus, MetricPoint } from '../../src/types/index.js';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SNAPSHOT_DIR = resolve(ROOT, 'data/snapshots');
export const HISTORY_FILE = resolve(ROOT, 'data/history/metrics.ndjson');

/** Per-call overrides; `attempts: 1` marks a call as optional enrichment. */
export interface FetchOpts extends RequestInit {
  attempts?: number;
  timeoutMs?: number;
}

export interface SourceContext {
  /** Fetch with retry/backoff, a hard timeout, and a descriptive UA. */
  get(url: string, init?: FetchOpts): Promise<Response>;
  getText(url: string, init?: FetchOpts): Promise<string>;
  getJson<T>(url: string, init?: FetchOpts): Promise<T>;
  /** Record a scalar into the append-only time series. */
  metric(name: string, value: number, unit?: string): void;
  log(msg: string): void;
}

export interface SourceDefinition<T> {
  id: string;
  label: string;
  pillar: PillarId;
  attribution: { name: string; url: string; license?: string };
  /** Rough guide for humans; the cron runs everything daily. */
  cadence: 'daily' | 'weekly';
  /**
   * Wall-clock ceiling for the whole source. Retries against a rate-limited
   * upstream compound quickly, so without this a single slow source can hang
   * a CI run; exceeding it is treated as a normal failure (serve prior data).
   */
  timeBudgetMs?: number;
  /** Well-formed zero value, served when a source has never succeeded. */
  empty: T;
  collect(ctx: SourceContext): Promise<T>;
  /** Number of records, for the health panel. */
  count(data: T): number;
}

/** Helper so each source file gets full type inference on `collect`. */
export function defineSource<T>(def: SourceDefinition<T>): SourceDefinition<T> {
  return def;
}

const UA = 'ai-ecosystem-observatory/1.0 (+https://github.com/jobdewilde95/artificial-intelligence-ecosystem)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retrying fetch. Verified during design that arXiv/OpenAlex/pypistats return
 * 429 from shared egress IPs, so backing off on 429/5xx is the common path,
 * not an edge case. 4xx other than 429 fails fast — retrying won't fix them.
 */
async function retryingFetch(
  url: string,
  init: RequestInit = {},
  attempts: number = 4,
  timeoutMs: number = 45_000,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(Math.min(2 ** i * 1000, 16_000));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { 'user-agent': UA, ...(init.headers ?? {}) },
      });
      if (res.ok) return res;
      const httpErr = new Error(`HTTP ${res.status} ${res.statusText}`);
      // Only 429 and 5xx are worth another attempt. Every other 4xx is a
      // permanent answer — retrying it just burns the backoff budget, which
      // is what made a scoped-out 403 take minutes instead of milliseconds.
      if (res.status !== 429 && res.status < 500) throw Object.assign(httpErr, { fatal: true });
      lastErr = httpErr;
      continue;
    } catch (err) {
      lastErr = err;
      if ((err as { fatal?: boolean })?.fatal) break;
      if (i === attempts - 1) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const DEFAULT_TIME_BUDGET_MS = 240_000;

export function makeContext(sourceId: string, metrics: MetricPoint[], ts: string): SourceContext {
  const push = (name: string, value: number, unit?: string) => {
    if (Number.isFinite(value)) metrics.push({ ts, metric: name, value, ...(unit ? { unit } : {}) });
  };
  const call = (url: string, init: FetchOpts = {}) => {
    const { attempts, timeoutMs, ...rest } = init;
    return retryingFetch(url, rest, attempts, timeoutMs);
  };
  return {
    get: (url, init) => call(url, init),
    getText: async (url, init) => (await call(url, init)).text(),
    getJson: async <T,>(url: string, init?: FetchOpts) =>
      (await call(url, { ...init, headers: { accept: 'application/json', ...(init?.headers ?? {}) } })).json() as Promise<T>,
    metric: push,
    log: (msg) => console.log(`    ${sourceId}: ${msg}`),
  };
}

export async function readSnapshot<T>(sourceId: string): Promise<Snapshot<T> | null> {
  const file = resolve(SNAPSHOT_DIR, `${sourceId}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Snapshot<T>;
  } catch {
    return null;
  }
}

export async function writeSnapshot<T>(snapshot: Snapshot<T>): Promise<void> {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const file = resolve(SNAPSHOT_DIR, `${snapshot.sourceId}.json`);
  await writeFile(file, JSON.stringify(snapshot, null, 1) + '\n', 'utf8');
}

export async function appendMetrics(points: MetricPoint[]): Promise<void> {
  if (!points.length) return;
  await mkdir(dirname(HISTORY_FILE), { recursive: true });
  const lines = points.map((p) => JSON.stringify(p)).join('\n') + '\n';
  const prior = existsSync(HISTORY_FILE) ? await readFile(HISTORY_FILE, 'utf8') : '';
  await writeFile(HISTORY_FILE, prior + lines, 'utf8');
}

export interface RunResult {
  sourceId: string;
  status: SourceStatus;
  recordCount: number;
  error?: string;
  durationMs: number;
  /** When this source last actually reached its upstream — carried forward
   *  across failures, so a stale source reports its real age instead of
   *  looking like it never succeeded. */
  lastSuccess: string | null;
}

/**
 * Runs one source. The contract that matters: a failure NEVER throws out of
 * here and never discards good data — the previous snapshot is rewritten with
 * status 'stale' so the dashboard keeps rendering (and visibly flags the age).
 */
export async function runSource<T>(
  def: SourceDefinition<T>,
  metrics: MetricPoint[],
  ts: string,
): Promise<RunResult> {
  const started = Date.now();
  const prior = await readSnapshot<T>(def.id);
  const ctx = makeContext(def.id, metrics, ts);
  try {
    const budget = def.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    const data = await Promise.race([
      def.collect(ctx),
      new Promise<never>((_, reject) => {
        budgetTimer = setTimeout(
          () => reject(new Error(`exceeded ${Math.round(budget / 1000)}s time budget`)),
          budget,
        );
      }),
    ]).finally(() => clearTimeout(budgetTimer));
    const recordCount = def.count(data);
    const status: SourceStatus = recordCount > 0 ? 'ok' : 'empty';
    await writeSnapshot<T>({
      sourceId: def.id,
      label: def.label,
      status,
      fetchedAt: ts,
      lastSuccess: ts,
      attribution: def.attribution,
      data,
    });
    return { sourceId: def.id, status, recordCount, durationMs: Date.now() - started, lastSuccess: ts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (prior) {
      await writeSnapshot<T>({
        ...prior,
        status: 'stale',
        fetchedAt: ts,
        error: message,
      });
      return {
        sourceId: def.id,
        status: 'stale',
        recordCount: def.count(prior.data),
        error: message,
        durationMs: Date.now() - started,
        lastSuccess: prior.lastSuccess,
      };
    }
    // No prior data at all: write an empty envelope so the UI has something
    // well-formed to read and the health panel can report the outage.
    await writeSnapshot<T>({
      sourceId: def.id,
      label: def.label,
      status: 'empty',
      fetchedAt: ts,
      lastSuccess: null,
      error: message,
      attribution: def.attribution,
      data: def.empty,
    });
    return { sourceId: def.id, status: 'empty', recordCount: 0, error: message, durationMs: Date.now() - started, lastSuccess: null };
  }
}

/* --------------------------- small shared utils --------------------------- */

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export const num = (v: string | undefined | null): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

export const yearOf = (d: string | null): number | null => {
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) && y > 1900 && y < 2100 ? y : null;
};

export function median(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function tally<T>(items: T[], key: (t: T) => string | null): Array<{ key: string; count: number }> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}
