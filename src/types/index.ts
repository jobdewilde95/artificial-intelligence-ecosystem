/**
 * Shared contract between the collectors (scripts/collect) and the UI (src).
 * Both sides import from here, so a schema drift is a typecheck failure rather
 * than a silently empty chart.
 */

export type SourceStatus = 'ok' | 'stale' | 'empty';

/** Every snapshot file on disk is one of these envelopes. */
export interface Snapshot<T> {
  sourceId: string;
  /** Human label for the Data Health panel. */
  label: string;
  status: SourceStatus;
  /** ISO timestamp of the run that produced this file. */
  fetchedAt: string;
  /** ISO timestamp of the last run that actually reached the source. */
  lastSuccess: string | null;
  /** Populated when the last attempt failed and we are serving prior data. */
  error?: string;
  /** Where the data came from, shown in the UI so every number is traceable. */
  attribution: { name: string; url: string; license?: string };
  data: T;
}

export interface SourceHealth {
  sourceId: string;
  label: string;
  pillar: PillarId;
  status: SourceStatus;
  fetchedAt: string;
  lastSuccess: string | null;
  error?: string;
  recordCount: number;
  attribution: { name: string; url: string; license?: string };
}

export type PillarId =
  | 'capability'
  | 'compute'
  | 'capital'
  | 'opensource'
  | 'research'
  | 'policy'
  | 'safety'
  | 'adoption';

/* ------------------------------- capability ------------------------------ */

export interface AiModel {
  name: string;
  organization: string;
  orgCategory: string | null;
  country: string | null;
  publicationDate: string | null;
  domain: string | null;
  /** Training compute in FLOP. Null where Epoch has no estimate. */
  trainingComputeFlop: number | null;
  parameters: number | null;
  datasetSize: number | null;
  /** Training cost in 2023 USD, where estimated. */
  costUsd2023: number | null;
  trainingHardware: string | null;
  hardwareQuantity: number | null;
  accessibility: string | null;
  openWeights: boolean | null;
  frontier: boolean;
  link: string | null;
}

export interface CapabilityData {
  models: AiModel[];
  /** Pre-aggregated so the browser never reduces 1k+ rows on mount. */
  byYear: Array<{
    year: number;
    count: number;
    frontierCount: number;
    openWeightCount: number;
    maxComputeFlop: number | null;
    medianComputeFlop: number | null;
  }>;
  topOrganizations: Array<{ organization: string; count: number; frontierCount: number }>;
  byCountry: Array<{ country: string; count: number }>;
}

/* -------------------------------- compute -------------------------------- */

export interface ComputeCluster {
  name: string;
  status: string | null;
  certainty: string | null;
  owner: string | null;
  country: string | null;
  chipType: string | null;
  chipQuantity: number | null;
  h100Equivalents: number | null;
  /** log10 of max OP/s, as Epoch publishes it. */
  maxOpsLog: number | null;
  firstOperational: string | null;
}

export interface ComputeData {
  clusters: ComputeCluster[];
  byCountry: Array<{ country: string; count: number; h100Equivalents: number }>;
  byOwner: Array<{ owner: string; count: number; h100Equivalents: number }>;
  byYear: Array<{ year: number; count: number; h100Equivalents: number }>;
  largest: ComputeCluster | null;
}

/* -------------------------------- capital -------------------------------- */

export interface ServedModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number | null;
  promptUsdPerMTok: number | null;
  completionUsdPerMTok: number | null;
  modalities: string[];
  created: string | null;
}

export interface CapitalData {
  servedModels: ServedModel[];
  providerCount: number;
  /** Cheapest / median prices let us track the collapse in inference cost. */
  priceStats: {
    medianPromptUsdPerMTok: number | null;
    minPromptUsdPerMTok: number | null;
    medianCompletionUsdPerMTok: number | null;
  };
  byProvider: Array<{ provider: string; count: number; medianPromptUsdPerMTok: number | null }>;
  contextLengthBuckets: Array<{ bucket: string; count: number }>;
}

/* ------------------------------- opensource ------------------------------ */

export interface RepoStat {
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  pushedAt: string | null;
  category: string;
}

export interface OpenSourceData {
  repos: RepoStat[];
  /**
   * The Hub exposes no total-count endpoint (x-total-count is listed in
   * access-control-expose-headers but never actually sent), so this tracks
   * what the API does return rather than inventing a total.
   */
  hub: {
    topDownloaded: Array<{ id: string; downloads: number; likes: number }>;
    topTrending: Array<{ id: string; author: string | null; likes: number; downloads: number }>;
    trendingAuthors: Array<{ author: string; count: number }>;
  };
}

/* -------------------------------- research ------------------------------- */

export interface ResearchData {
  /** Publication counts per year for AI-related search terms. */
  byYear: Array<{ year: number; count: number }>;
  totalMatching: number | null;
  recent: Array<{ title: string; date: string; doi: string | null; venue: string | null }>;
  /** arXiv listing counts per category, when reachable. */
  byCategory: Array<{ category: string; label: string; count: number }>;
}

/* --------------------------------- policy -------------------------------- */

export interface PolicyDocument {
  title: string;
  date: string;
  type: string;
  agencies: string[];
  url: string;
  /** 0-1 relevance from our scorer; the raw term search has false positives. */
  relevance: number;
}

export interface PolicyData {
  documents: PolicyDocument[];
  /** Documents substantively about AI (passed the relevance gate). */
  byYear: Array<{ year: number; count: number }>;
  /**
   * Documents that merely *mention* AI anywhere in their full text. Tracked
   * alongside `byYear` because the gap between the two is itself the finding:
   * AI mentions stay high while dedicated AI rulemaking has fallen since 2024.
   */
  byYearMentions: Array<{ year: number; count: number }>;
  byType: Array<{ type: string; count: number }>;
  byAgency: Array<{ agency: string; count: number }>;
  totalMatching: number | null;
  /**
   * Oldest document in the fetched window. Earlier years are truncated by the
   * fetch cap, so the UI must not present them as a real decline.
   */
  corpusEarliestDate: string | null;
}

/* -------------------------------- adoption ------------------------------- */

export interface DiscourseData {
  /** Front-page AI story volume as a rough discourse proxy. */
  topStories: Array<{ title: string; score: number; url: string | null; date: string }>;
  aiShareOfFrontPage: number | null;
  sampled: number;
}

/* -------------------------------- curated -------------------------------- */

export interface Lab {
  id: string;
  name: string;
  country: string;
  founded: number | null;
  category: 'frontier' | 'bigtech' | 'open' | 'research' | 'chips' | 'infra';
  notes: string;
  url: string | null;
}

export interface PolicyMilestone {
  date: string;
  jurisdiction: string;
  title: string;
  kind: 'law' | 'regulation' | 'executive' | 'agreement' | 'export-control' | 'standard';
  status: 'in-force' | 'phasing-in' | 'proposed' | 'superseded';
  summary: string;
  url: string | null;
}

export interface FundingRound {
  date: string;
  company: string;
  amountUsdM: number;
  round: string;
  valuationUsdB: number | null;
  investors: string;
  url: string | null;
}

export interface SafetyEvent {
  date: string;
  title: string;
  category: 'incident' | 'evaluation' | 'commitment' | 'framework' | 'research';
  severity: 'low' | 'medium' | 'high' | 'informational';
  summary: string;
  url: string | null;
}

export interface AdoptionIndicator {
  label: string;
  value: number;
  unit: string;
  asOf: string;
  source: string;
  url: string | null;
  note: string;
}

export interface CuratedData {
  labs: Lab[];
  policyMilestones: PolicyMilestone[];
  funding: FundingRound[];
  safetyEvents: SafetyEvent[];
  adoption: AdoptionIndicator[];
}

/* -------------------------------- history -------------------------------- */

/** One row of data/history/metrics.ndjson. Appended once per refresh run. */
export interface MetricPoint {
  ts: string;
  metric: string;
  value: number;
  unit?: string;
}
