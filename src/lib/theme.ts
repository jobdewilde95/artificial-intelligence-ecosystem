import { useEffect, useState } from 'react';

export interface Tokens {
  series: string[];
  seq: string[];
  ink: string;
  inkSecondary: string;
  muted: string;
  grid: string;
  baseline: string;
  surface: string;
  status: { good: string; warning: string; serious: string; critical: string };
}

const read = (s: CSSStyleDeclaration, name: string) => s.getPropertyValue(name).trim();

export function readTokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  return {
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => read(s, `--series-${i}`)),
    seq: ['--seq-100', '--seq-250', '--seq-400', '--seq-550', '--seq-700'].map((n) => read(s, n)),
    ink: read(s, '--text-primary'),
    inkSecondary: read(s, '--text-secondary'),
    muted: read(s, '--text-muted'),
    grid: read(s, '--gridline'),
    baseline: read(s, '--baseline'),
    surface: read(s, '--surface-1'),
    status: {
      good: read(s, '--status-good'),
      warning: read(s, '--status-warning'),
      serious: read(s, '--status-serious'),
      critical: read(s, '--status-critical'),
    },
  };
}

const STORAGE_KEY = 'aieo-theme';

export type Theme = 'dark' | 'light';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Private mode or blocked storage — fall through to the media query.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persisting the preference is a convenience, never a requirement.
    }
  }, [theme]);

  return [theme, setTheme];
}

/** Re-reads tokens whenever the theme class flips, so charts restyle in place. */
export function useTokens(): Tokens | null {
  const [tokens, setTokens] = useState<Tokens | null>(null);

  useEffect(() => {
    const update = () => setTokens(readTokens());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
