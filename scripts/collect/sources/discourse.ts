import { defineSource } from '../framework.js';
import type { DiscourseData } from '../../../src/types/index.js';

const HN = 'https://hacker-news.firebaseio.com/v0';

/** Loose matcher — this is a volume proxy, not a classifier. */
const AI_PATTERN =
  /\b(ai|a\.i\.|llm|llms|gpt|claude|gemini|openai|anthropic|deepseek|mistral|qwen|llama|transformer|diffusion|agentic|machine learning|neural|inference|fine-?tun\w*|rag|embedding|mcp)\b/i;

interface HnItem { title?: string; score?: number; url?: string; time?: number; type?: string }

export default defineSource<DiscourseData>({
  id: 'discourse',
  label: 'Developer discourse (Hacker News)',
  pillar: 'adoption',
  cadence: 'daily',
  attribution: { name: 'Hacker News API', url: 'https://github.com/HackerNews/API' },
  timeBudgetMs: 120_000,
  empty: { topStories: [], aiShareOfFrontPage: null, sampled: 0 },

  async collect(ctx) {
    const ids = await ctx.getJson<number[]>(`${HN}/topstories.json`);
    const sample = ids.slice(0, 100);

    const items: HnItem[] = [];
    // Batch to stay friendly to the API rather than firing 100 at once.
    for (let i = 0; i < sample.length; i += 10) {
      const batch = await Promise.all(
        sample.slice(i, i + 10).map(async (id) => {
          try {
            return await ctx.getJson<HnItem>(`${HN}/item/${id}.json`, { attempts: 2, timeoutMs: 15_000 });
          } catch {
            return null;
          }
        }),
      );
      items.push(...batch.filter((b): b is HnItem => b != null));
    }

    const stories = items.filter((i) => i.type === 'story' && i.title);
    const aiStories = stories.filter((s) => AI_PATTERN.test(s.title ?? ''));
    ctx.log(`${aiStories.length}/${stories.length} front-page stories match AI terms`);

    const share = stories.length ? aiStories.length / stories.length : null;
    if (share != null) ctx.metric('adoption.hn_ai_share', Number((share * 100).toFixed(1)), '%');

    return {
      topStories: aiStories
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 25)
        .map((s) => ({
          title: s.title ?? '',
          score: s.score ?? 0,
          url: s.url ?? null,
          date: s.time ? new Date(s.time * 1000).toISOString().slice(0, 10) : '',
        })),
      aiShareOfFrontPage: share,
      sampled: stories.length,
    };
  },

  count: (d) => d.topStories.length,
});
