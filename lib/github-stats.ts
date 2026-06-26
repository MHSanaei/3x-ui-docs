import { productRepo } from './shared';

export interface GitHubStats {
  stars: number;
  forks: number;
  latestVersion: string;
}

// Real, recent numbers used as a fallback when the GitHub API is unavailable
// at build time (offline CI, rate limit). Update periodically.
const FALLBACK: GitHubStats = {
  stars: 41500,
  forks: 7700,
  latestVersion: 'v3.x',
};

/**
 * Fetch repo stats at build time (Server Component / build only — never called
 * from the client, so there is no runtime rate-limit or CORS exposure).
 * Always resolves; on any error it returns the hardcoded fallback.
 */
export async function getGitHubStats(): Promise<GitHubStats> {
  const base = `https://api.github.com/repos/${productRepo.user}/${productRepo.repo}`;
  const headers: Record<string, string> = {
    'User-Agent': '3x-ui-docs',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const [repoRes, releaseRes] = await Promise.all([
      fetch(base, { headers, next: { revalidate: 3600 } }),
      fetch(`${base}/releases/latest`, { headers, next: { revalidate: 3600 } }),
    ]);

    if (!repoRes.ok) return FALLBACK;
    const repo = (await repoRes.json()) as { stargazers_count?: number; forks_count?: number };

    let latestVersion = FALLBACK.latestVersion;
    if (releaseRes.ok) {
      const release = (await releaseRes.json()) as { tag_name?: string };
      if (release.tag_name) latestVersion = release.tag_name;
    }

    return {
      stars: repo.stargazers_count ?? FALLBACK.stars,
      forks: repo.forks_count ?? FALLBACK.forks,
      latestVersion,
    };
  } catch {
    return FALLBACK;
  }
}

/** Compact display, e.g. 41523 -> "41.5k". */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
