import { defineSource } from '../framework.js';
import type { ResearchData } from '../../../src/types/index.js';

const CROSSREF = 'https://api.crossref.org/works';
const ARXIV_CATEGORIES: Array<{ category: string; label: string }> = [
  { category: 'cs.AI', label: 'Artificial Intelligence' },
  { category: 'cs.LG', label: 'Machine Learning' },
  { category: 'cs.CL', label: 'Computation & Language' },
  { category: 'cs.CV', label: 'Computer Vision' },
  { category: 'cs.NE', label: 'Neural & Evolutionary' },
  { category: 'cs.RO', label: 'Robotics' },
  { category: 'stat.ML', label: 'ML (Statistics)' },
];

interface CrossrefResponse {
  message?: {
    'total-results'?: number;
    items?: Array<{
      title?: string[];
      DOI?: string;
      'container-title'?: string[];
      created?: { 'date-time'?: string };
      issued?: { 'date-parts'?: number[][] };
    }>;
  };
}

const QUERY = 'artificial intelligence OR machine learning OR deep learning OR large language model';

export default defineSource<ResearchData>({
  id: 'research',
  label: 'AI research publication volume',
  pillar: 'research',
  cadence: 'daily',
  attribution: { name: 'Crossref REST API & arXiv', url: 'https://api.crossref.org' },
  // Crossref is 12 sequential year queries and arXiv rate-limits shared IPs;
  // without a ceiling the compounded backoff can stall a CI run.
  timeBudgetMs: 180_000,
  empty: { byYear: [], totalMatching: null, recent: [], byCategory: [] },

  async collect(ctx) {
    const mailto = 'jobdewilde95@gmail.com'; // Crossref's "polite pool" wants a contact.

    // Yearly totals. One cheap rows=0 request per year reads the facet count.
    const thisYear = new Date().getUTCFullYear();
    const wanted: number[] = [];
    for (let year = 2015; year <= thisYear; year++) wanted.push(year);

    const years: Array<{ year: number; count: number }> = [];
    for (let i = 0; i < wanted.length; i += 4) {
      const batch = await Promise.all(
        wanted.slice(i, i + 4).map(async (year) => {
          const url =
            `${CROSSREF}?query.bibliographic=${encodeURIComponent(QUERY)}` +
            `&filter=from-pub-date:${year}-01-01,until-pub-date:${year}-12-31&rows=0&mailto=${mailto}`;
          try {
            const body = await ctx.getJson<CrossrefResponse>(url, { attempts: 2, timeoutMs: 20_000 });
            return { year, count: body.message?.['total-results'] ?? 0 };
          } catch {
            return null;
          }
        }),
      );
      years.push(...batch.filter((b): b is { year: number; count: number } => b != null));
    }
    years.sort((a, b) => a.year - b.year);
    ctx.log(`${years.length}/${wanted.length} yearly buckets`);

    let totalMatching: number | null = null;
    let recent: ResearchData['recent'] = [];
    try {
      const body = await ctx.getJson<CrossrefResponse>(
        `${CROSSREF}?query.bibliographic=${encodeURIComponent(QUERY)}&sort=published&order=desc&rows=25&mailto=${mailto}`,
        { attempts: 2, timeoutMs: 20_000 },
      );
      totalMatching = body.message?.['total-results'] ?? null;
      recent = (body.message?.items ?? []).map((i) => {
        const parts = i.issued?.['date-parts']?.[0];
        const date = parts
          ? `${parts[0]}-${String(parts[1] ?? 1).padStart(2, '0')}-${String(parts[2] ?? 1).padStart(2, '0')}`
          : (i.created?.['date-time'] ?? '').slice(0, 10);
        return {
          title: i.title?.[0] ?? 'Untitled',
          date,
          doi: i.DOI ?? null,
          venue: i['container-title']?.[0] ?? null,
        };
      });
    } catch (err) {
      ctx.log(`recent works failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // arXiv rate-limits shared egress IPs hard (429s during development), so
    // treat its counts as a bonus: failure here must not fail the source.
    const byCategory: ResearchData['byCategory'] = [];
    for (const { category, label } of ARXIV_CATEGORIES) {
      try {
        const xml = await ctx.getText(
          `https://export.arxiv.org/api/query?search_query=cat:${category}&max_results=0`,
          { attempts: 1, timeoutMs: 15_000 },
        );
        const match = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
        if (match) byCategory.push({ category, label, count: Number(match[1]) });
      } catch {
        // Intentionally silent: arXiv is optional enrichment.
      }
    }
    if (byCategory.length) ctx.log(`arXiv: ${byCategory.length}/${ARXIV_CATEGORIES.length} categories`);
    else ctx.log('arXiv unavailable (rate limited) — continuing without it');

    if (totalMatching != null) ctx.metric('research.crossref_total', totalMatching, 'works');
    const current = years.find((y) => y.year === thisYear);
    if (current) ctx.metric('research.works_ytd', current.count, 'works');
    const arxivTotal = byCategory.reduce((s, c) => s + c.count, 0);
    if (arxivTotal) ctx.metric('research.arxiv_total', arxivTotal, 'papers');

    return { byYear: years, totalMatching, recent, byCategory };
  },

  count: (d) => d.byYear.length + d.recent.length,
});
