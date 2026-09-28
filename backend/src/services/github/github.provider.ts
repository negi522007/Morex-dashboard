import { Injectable } from '@nestjs/common';
import { fetchWithTimeout } from '../../common/fetch-timeout.util';
import { UNTRUSTED_RULES, clip, languageName } from '../../ai/ai.service';
import { ServiceAuthContext, ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;

// Accepts "owner/name" as-is, or a GitHub URL someone pasted instead of picking from the dropdown
// (https://github.com/owner/name, with or without a trailing slash/.git) — normalized to "owner/name"
// either way, so a pasted link never silently 404s on every refresh forever.
function parseRepo(config: Record<string, string | number>, widgetName: string): string {
  const raw = String(config.repo ?? '').trim();
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?\/?$/i.exec(raw);
  const repo = url ? url[1] : raw;
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new ServiceFetchError('github', widgetName, 'The "repo" parameter must look like "owner/name" (a GitHub URL also works)');
  }
  return repo;
}

function parsePerPage(config: Record<string, string | number>): number {
  const parsed = Number(config.number);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30) : 5;
}

// Auth is optional here even though the service is requiresAuth: true — a
// linked account mainly raises the rate limit (5000/h vs 60/h). It does NOT
// grant access to private repos: the OAuth scope requested at linking time
// (read:user user:email) deliberately excludes `repo`/`public_repo` — least
// privilege, since this widget only ever reads. Public repos work with or
// without a linked account; a private repo 404s either way (verified: the
// team's own private Epitech repo returns 404, a public repo like
// nestjs/nest works). Widgets configured against a private repo will error
// — expected given the scope, not a bug.
async function githubGet(path: string, auth: ServiceAuthContext | undefined, widgetName: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dashboard-app',
  };
  if (auth?.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(`https://api.github.com${path}`, { headers }, FETCH_TIMEOUT_MS);
  } catch (err) {
    throw new ServiceFetchError('github', widgetName, `Could not reach GitHub API: ${(err as Error).message}`);
  }
  if (!res.ok) {
    throw new ServiceFetchError('github', widgetName, `GitHub API returned HTTP ${res.status}`);
  }
  return res.json();
}

const REPO_OPTIONS_URL = '/services/github/repos';

const recentCommits: WidgetDefinition = {
  name: 'recent_commits',
  description: 'Display the most recent commit messages and authors for a repository',
  params: [
    { name: 'repo', type: 'string', required: true, optionsUrl: REPO_OPTIONS_URL },
    { name: 'number', type: 'integer' },
  ],
  async fetchData(config, auth) {
    const repo = parseRepo(config, 'recent_commits');
    const perPage = parsePerPage(config);

    const data = await githubGet(`/repos/${repo}/commits?per_page=${perPage}`, auth, 'recent_commits');
    return (data as any[]).map((commit) => ({
      sha: commit.sha?.slice(0, 7),
      message: commit.commit?.message?.split('\n')[0],
      author: commit.commit?.author?.name ?? commit.author?.login ?? 'unknown',
      date: commit.commit?.author?.date,
    }));
  },
};

const openIssues: WidgetDefinition = {
  name: 'open_issues',
  description: 'Display the currently open issues for a repository',
  params: [
    { name: 'repo', type: 'string', required: true, optionsUrl: REPO_OPTIONS_URL },
    { name: 'number', type: 'integer' },
  ],
  async fetchData(config, auth) {
    const repo = parseRepo(config, 'open_issues');
    const perPage = parsePerPage(config);

    const data = await githubGet(`/repos/${repo}/issues?state=open&per_page=${perPage}`, auth, 'open_issues');
    // GitHub's /issues endpoint also returns pull requests; exclude them.
    return (data as any[])
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        author: issue.user?.login,
        createdAt: issue.created_at,
      }));
  },
};

const repoStats: WidgetDefinition = {
  name: 'repo_stats',
  description: 'Display star, fork, and open issue counts for a repository',
  params: [{ name: 'repo', type: 'string', required: true, optionsUrl: REPO_OPTIONS_URL }],
  primaryMetric: (d) => ((d as { stars?: unknown })?.stars as number) ?? null,
  async fetchData(config, auth) {
    const repo = parseRepo(config, 'repo_stats');
    const data = await githubGet(`/repos/${repo}`, auth, 'repo_stats');
    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      description: data.description,
    };
  },
};

interface DailyChanges {
  repo: string;
  hours: number;
  since: string;
  commitCount: number;
  authors: { name: string; count: number }[];
  commits: { sha: string; message: string; author: string; date: string }[];
}

const dailyChanges: WidgetDefinition = {
  name: 'daily_changes',
  description: 'What changed in a repository over the last hours (with an optional AI stand-up)',
  params: [
    { name: 'repo', type: 'string', required: true, optionsUrl: REPO_OPTIONS_URL },
    { name: 'hours', type: 'integer' },
  ],
  primaryMetric: (d) => ((d as { commitCount?: unknown })?.commitCount as number) ?? null,
  async fetchData(config, auth): Promise<DailyChanges> {
    const repo = parseRepo(config, 'daily_changes');
    const parsed = Number(config.hours);
    const hours = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 168) : 24;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const data = (await githubGet(`/repos/${repo}/commits?since=${encodeURIComponent(since)}&per_page=50`, auth, 'daily_changes')) as any[];
    const commits = data.map((c) => ({
      sha: String(c.sha ?? '').slice(0, 7),
      message: String(c.commit?.message ?? '').split('\n')[0],
      author: c.commit?.author?.name ?? c.author?.login ?? 'unknown',
      date: c.commit?.author?.date as string,
    }));
    const counts = new Map<string, number>();
    for (const c of commits) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
    return {
      repo,
      hours,
      since,
      commitCount: commits.length,
      authors: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      commits: commits.slice(0, 15),
    };
  },
  // Stand-up notes from commit messages (public-repo content only, see PRIVACY.md).
  async enrich(data, ctx) {
    const d = data as DailyChanges;
    if (d.commitCount === 0) return { kind: 'standup', summary: '', highlights: [], language: ctx.language };
    const out = await ctx.ai.completeJson<{ summary?: string; highlights?: string[] }>({
      system:
        `You write a stand-up note from git commit messages, in ${languageName(ctx.language)}. ${UNTRUSTED_RULES} ` +
        'Schema: {"summary": string (max 220 chars: what moved forward), "highlights": string[] (max 4 items, each max 100 chars, grouped by theme not by commit)}. Only mention what the messages say.',
      user: `<data>${JSON.stringify({ repo: d.repo, hours: d.hours, commits: d.commits.map((c) => ({ message: clip(c.message, 140), author: c.author })) })}</data>`,
      maxTokens: 500,
      mock: { summary: `${d.commitCount} commit(s) in the last ${d.hours}h`, highlights: d.commits.slice(0, 4).map((c) => clip(c.message, 100)) },
    });
    return {
      kind: 'standup',
      summary: clip(out.summary ?? '', 230),
      highlights: (out.highlights ?? []).filter((h) => typeof h === 'string').slice(0, 4).map((h) => clip(h, 110)),
      language: ctx.language,
    };
  },
};

export interface RepoOption {
  value: string;
  label: string;
}

@Injectable()
export class GithubProvider implements ServiceProvider {
  name = 'github';
  requiresAuth = true;
  widgets: WidgetDefinition[] = [recentCommits, openIssues, repoStats, dailyChanges];

  // Backs GET /services/github/repos (github-repos.controller.ts) — feeds
  // the repo picker on the "add widget" form. First 100 repos, most
  // recently updated first; no pagination yet (matches "avoid designing for
  // hypothetical needs" — revisit if someone with 100+ repos hits this).
  async listRepos(auth: ServiceAuthContext): Promise<RepoOption[]> {
    const repos = await githubGet('/user/repos?per_page=100&sort=updated', auth, 'list_repos');
    return (repos as any[]).map((repo) => ({ value: repo.full_name, label: repo.full_name }));
  }
}
