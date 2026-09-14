import { defineSource } from '../framework.js';
import type { PolicyData, PolicyDocument } from '../../../src/types/index.js';

const BASE = 'https://www.federalregister.gov/api/v1/documents.json';

/**
 * The Federal Register term search matches full document text, which drags in
 * clear false positives — a "Draft NIH Biosafety Policy for Research Involving
 * Biohazards" ranked in the top 2 results for "artificial intelligence" while
 * building this. So we over-fetch for recall and score for precision instead of
 * trusting the term match.
 */
const STRONG = [
  'artificial intelligence',
  'machine learning',
  'large language model',
  'foundation model',
  'generative ai',
  'neural network',
  'deep learning',
  'automated decision',
  'algorithmic discrimination',
  'frontier model',
  'ai system',
  'ai model',
];
const WEAK = ['algorithm', 'autonomous', 'automation', 'chatbot', 'facial recognition', 'compute'];

/** Agencies that actually make AI policy; a weak nudge, never decisive. */
const AI_AGENCIES = [
  'national institute of standards and technology',
  'office of science and technology policy',
  'federal trade commission',
  'bureau of industry and security',
  'national telecommunications and information administration',
  'department of commerce',
  'office of management and budget',
  'national science foundation',
  'federal communications commission',
  'department of energy',
  'copyright office',
  'patent and trademark office',
];

interface FrDoc {
  title?: string;
  abstract?: string | null;
  publication_date?: string;
  type?: string;
  html_url?: string;
  agencies?: Array<{ name?: string; raw_name?: string }>;
}

/**
 * Administrative boilerplate that the full-text term match drags in. These are
 * dropped unless the title itself names AI — a "Sunshine Act Meeting" that
 * mentions AI somewhere in the transcript is not an AI policy action.
 */
const BOILERPLATE = [
  'sunshine act',
  'agency information collection',
  'solicitation of nominations',
  'request for nominations',
  'notice of public meeting',
  'notice of public meetings',
  'membership on the',
  'advisory committee',
  'privacy act of 1974',
  'combined notice of filings',
  'self-regulatory organizations',
];

interface Scored {
  score: number;
  keep: boolean;
}

/**
 * The Federal Register term search matches full document text, but the API only
 * returns title and abstract — and many abstracts are empty. So a term match
 * alone proves nothing (a "Draft NIH Biosafety Policy" and a NOAA advisory-board
 * nomination both surfaced in the top results while building this). Precision
 * therefore comes from a hard gate, not from a score threshold: a document must
 * declare itself to be about AI in its title, or repeat AI terms in its
 * abstract, before any scoring applies.
 */
function scoreDocument(doc: FrDoc): Scored {
  const title = (doc.title ?? '').toLowerCase();
  const abstract = (doc.abstract ?? '').toLowerCase();
  const agencies = (doc.agencies ?? []).map((a) => (a.name ?? a.raw_name ?? '').toLowerCase());

  const titleHits = STRONG.filter((t) => title.includes(t));
  const abstractHits = STRONG.filter((t) => abstract.includes(t));
  const isPresidential = doc.type === 'Presidential Document';
  const isBoilerplate = BOILERPLATE.some((b) => title.includes(b));

  // The gate. Everything below is ranking, not admission.
  const gated =
    titleHits.length > 0 ||
    abstractHits.length >= 2 ||
    (isPresidential && abstractHits.length > 0);

  if (!gated || (isBoilerplate && titleHits.length === 0)) return { score: 0, keep: false };

  let score = 0;
  score += Math.min(0.6, titleHits.length * 0.45);
  score += Math.min(0.3, abstractHits.length * 0.12);
  for (const term of WEAK) {
    if (title.includes(term)) score += 0.04;
  }
  if (agencies.some((a) => AI_AGENCIES.some((known) => a.includes(known)))) score += 0.06;
  if (isPresidential) score += 0.2;

  return { score: Math.min(1, score), keep: true };
}

const THRESHOLD = 0.3;

export default defineSource<PolicyData>({
  id: 'policy',
  label: 'US Federal Register AI actions',
  pillar: 'policy',
  cadence: 'daily',
  attribution: { name: 'Federal Register API', url: 'https://www.federalregister.gov/developers/documentation/api/v1' },
  empty: { documents: [], byYear: [], byYearMentions: [], byType: [], byAgency: [], totalMatching: null, corpusEarliestDate: null },

  async collect(ctx) {
    const fields = ['title', 'abstract', 'publication_date', 'type', 'html_url', 'agencies']
      .map((f) => `fields[]=${f}`)
      .join('&');

    const collected: FrDoc[] = [];
    let totalMatching: number | null = null;

    // Page back through recent matches; 5 x 200 gives several years of depth.
    for (let page = 1; page <= 5; page++) {
      const url =
        `${BASE}?conditions[term]=${encodeURIComponent('"artificial intelligence"')}` +
        `&order=newest&per_page=200&page=${page}&${fields}`;
      const body = await ctx.getJson<{ count?: number; results?: FrDoc[] }>(url);
      if (totalMatching == null) totalMatching = body.count ?? null;
      const results = body.results ?? [];
      collected.push(...results);
      if (results.length < 200) break;
    }
    ctx.log(`fetched ${collected.length} candidates (API reports ${totalMatching} total matches)`);

    const documents: PolicyDocument[] = collected
      .map((d) => ({ doc: d, ...scoreDocument(d) }))
      .filter(({ keep, score }) => keep && score >= THRESHOLD)
      .map(({ doc, score: relevance }) => ({
        title: doc.title ?? 'Untitled',
        date: doc.publication_date ?? '',
        type: doc.type ?? 'Unknown',
        agencies: (doc.agencies ?? []).map((a) => a.name ?? a.raw_name ?? '').filter(Boolean),
        url: doc.html_url ?? '',
        relevance: Number(relevance.toFixed(2)),
      }))
      .filter((d) => d.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    ctx.log(`kept ${documents.length} after relevance filtering (dropped ${collected.length - documents.length})`);

    const countBy = <K extends string>(items: K[]): Array<{ key: K; count: number }> => {
      const m = new Map<K, number>();
      for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
      return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    };

    const toYearSeries = (dates: string[]) =>
      countBy(dates.map((d) => d.slice(0, 4)))
        .map(({ key, count }) => ({ year: Number(key), count }))
        .filter((y) => Number.isFinite(y.year) && y.year > 1900)
        .sort((a, b) => a.year - b.year);

    const byYear = toYearSeries(documents.map((d) => d.date));
    const candidateDates = collected.map((d) => d.publication_date ?? '').filter(Boolean);
    const byYearMentions = toYearSeries(candidateDates);
    const corpusEarliestDate = candidateDates.length ? candidateDates.slice().sort()[0] : null;

    const byType = countBy(documents.map((d) => d.type)).map(({ key, count }) => ({ type: key, count }));
    const byAgency = countBy(documents.flatMap((d) => d.agencies))
      .slice(0, 15)
      .map(({ key, count }) => ({ agency: key, count }));

    const thisYear = String(new Date().getUTCFullYear());
    ctx.metric('policy.documents_scored', documents.length, 'documents');
    ctx.metric('policy.documents_ytd', documents.filter((d) => d.date.startsWith(thisYear)).length, 'documents');

    return {
      documents: documents.slice(0, 400),
      byYear,
      byYearMentions,
      byType,
      byAgency,
      totalMatching,
      corpusEarliestDate,
    };
  },

  count: (d) => d.documents.length,
});
