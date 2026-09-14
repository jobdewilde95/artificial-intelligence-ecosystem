import { defineSource } from '../framework.js';
import type { OpenSourceData, RepoStat } from '../../../src/types/index.js';

/**
 * Tracked repositories, grouped by the role they play in the stack. Curated
 * deliberately: "most starred AI repo" is a popularity contest, whereas these
 * are the projects the ecosystem actually builds on. Extend freely.
 */
const TRACKED: Array<{ repo: string; category: string }> = [
  { repo: 'pytorch/pytorch', category: 'Framework' },
  { repo: 'tensorflow/tensorflow', category: 'Framework' },
  { repo: 'jax-ml/jax', category: 'Framework' },
  { repo: 'huggingface/transformers', category: 'Framework' },
  { repo: 'ggml-org/llama.cpp', category: 'Inference' },
  { repo: 'vllm-project/vllm', category: 'Inference' },
  { repo: 'sgl-project/sglang', category: 'Inference' },
  { repo: 'ollama/ollama', category: 'Inference' },
  { repo: 'langchain-ai/langchain', category: 'Agents & orchestration' },
  { repo: 'run-llama/llama_index', category: 'Agents & orchestration' },
  { repo: 'modelcontextprotocol/servers', category: 'Agents & orchestration' },
  { repo: 'browser-use/browser-use', category: 'Agents & orchestration' },
  { repo: 'chroma-core/chroma', category: 'Vector & retrieval' },
  { repo: 'qdrant/qdrant', category: 'Vector & retrieval' },
  { repo: 'milvus-io/milvus', category: 'Vector & retrieval' },
  { repo: 'open-webui/open-webui', category: 'Applications' },
  { repo: 'comfyanonymous/ComfyUI', category: 'Applications' },
  { repo: 'AUTOMATIC1111/stable-diffusion-webui', category: 'Applications' },
  { repo: 'huggingface/diffusers', category: 'Media generation' },
  { repo: 'unslothai/unsloth', category: 'Training & tuning' },
  { repo: 'hiyouga/LLaMA-Factory', category: 'Training & tuning' },
  { repo: 'axolotl-ai-cloud/axolotl', category: 'Training & tuning' },
  { repo: 'ray-project/ray', category: 'Infrastructure' },
  { repo: 'mlflow/mlflow', category: 'Infrastructure' },
  { repo: 'EleutherAI/lm-evaluation-harness', category: 'Evaluation' },
  { repo: 'openai/evals', category: 'Evaluation' },
];

interface GhRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  pushed_at: string | null;
}

interface HfModel { id: string; downloads?: number; likes?: number }

interface HfTrending {
  recentlyTrending?: Array<{
    repoData?: { id?: string; author?: string; likes?: number; downloads?: number };
  }>;
}

export default defineSource<OpenSourceData>({
  id: 'opensource',
  label: 'Open-source AI projects & Hugging Face Hub',
  pillar: 'opensource',
  cadence: 'daily',
  attribution: { name: 'GitHub API & Hugging Face Hub API', url: 'https://huggingface.co/docs/hub/api' },
  empty: { repos: [], hub: { topDownloaded: [], topTrending: [], trendingAuthors: [] } },

  async collect(ctx) {
    // GITHUB_TOKEN lifts the 60/hr anonymous cap to 5000/hr in Actions. Some
    // sandboxes inject a short placeholder value, and sending that is worse
    // than sending nothing (401 instead of an anonymous 200), so length-check it.
    const token = process.env.GITHUB_TOKEN;
    const usableToken = token && token.length >= 20 ? token : undefined;
    if (token && !usableToken) ctx.log('ignoring placeholder GITHUB_TOKEN; requesting anonymously');
    const ghHeaders: Record<string, string> = {
      accept: 'application/vnd.github+json',
      ...(usableToken ? { authorization: `Bearer ${usableToken}` } : {}),
    };

    const repos: RepoStat[] = [];
    for (const { repo, category } of TRACKED) {
      try {
        const r = await ctx.getJson<GhRepo>(`https://api.github.com/repos/${repo}`, { headers: ghHeaders });
        repos.push({
          fullName: r.full_name,
          description: r.description,
          stars: r.stargazers_count,
          forks: r.forks_count,
          openIssues: r.open_issues_count,
          language: r.language,
          pushedAt: r.pushed_at,
          category,
        });
      } catch (err) {
        // One dead repo (renamed, deleted) must not cost us the other 25.
        ctx.log(`skipped ${repo}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    ctx.log(`${repos.length}/${TRACKED.length} repos fetched`);

    let downloaded: HfModel[] = [];
    try {
      downloaded = await ctx.getJson<HfModel[]>(
        'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=20',
        { attempts: 2, timeoutMs: 20_000 },
      );
    } catch (err) {
      ctx.log(`hub downloads failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    let trendingRaw: HfTrending['recentlyTrending'] = [];
    try {
      // limit=20 is the cap on this endpoint; 24 and above return 400.
      const body = await ctx.getJson<HfTrending>('https://huggingface.co/api/trending?type=model&limit=20', {
        attempts: 2,
        timeoutMs: 20_000,
      });
      trendingRaw = body.recentlyTrending ?? [];
    } catch (err) {
      ctx.log(`hub trending failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const topTrending = trendingRaw
      .map((t) => t.repoData)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => ({
        id: r.id ?? '',
        author: r.author ?? null,
        likes: r.likes ?? 0,
        downloads: r.downloads ?? 0,
      }))
      .filter((r) => r.id);

    // Which organisations are currently shipping models people actually pick up.
    const authorCounts = new Map<string, number>();
    for (const t of topTrending) {
      if (!t.author) continue;
      authorCounts.set(t.author, (authorCounts.get(t.author) ?? 0) + 1);
    }
    const trendingAuthors = [...authorCounts.entries()]
      .map(([author, count]) => ({ author, count }))
      .sort((a, b) => b.count - a.count);
    ctx.log(`hub: ${downloaded.length} top-downloaded, ${topTrending.length} trending`);

    const totalStars = repos.reduce((s, r) => s + r.stars, 0);
    if (repos.length) {
      ctx.metric('opensource.tracked_repo_stars', totalStars, 'stars');
      ctx.metric('opensource.tracked_repos', repos.length, 'repos');
    }
    if (topTrending.length) {
      ctx.metric('opensource.hf_trending_downloads', topTrending.reduce((s, t) => s + t.downloads, 0), 'downloads');
    }

    return {
      repos: repos.sort((a, b) => b.stars - a.stars),
      hub: {
        topDownloaded: downloaded.map((m) => ({ id: m.id, downloads: m.downloads ?? 0, likes: m.likes ?? 0 })),
        topTrending,
        trendingAuthors,
      },
    };
  },

  // Hub data alone is a useful snapshot, so don't call the source empty just
  // because GitHub was unreachable.
  count: (d) => d.repos.length + d.hub.topTrending.length,
});
