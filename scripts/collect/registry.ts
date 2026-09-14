import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SourceDefinition } from './framework.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Auto-discovers every module in ./sources. Adding a data source is therefore
 * "drop a file in that directory" — no registration list to keep in sync.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadSources(): Promise<SourceDefinition<any>[]> {
  const dir = resolve(HERE, 'sources');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sources: SourceDefinition<any>[] = [];
  for (const file of files.sort()) {
    const mod = await import(pathToFileURL(resolve(dir, file)).href);
    const def = mod.default;
    if (!def?.id || typeof def.collect !== 'function') {
      throw new Error(`${file} does not default-export a source definition`);
    }
    sources.push(def);
  }
  return sources;
}
