import { Injectable } from '@nestjs/common';
import { ServiceAuthContext, ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;

function parseRepo(config: Record<string, string | number>, widgetName: string): string {
  const repo = String(config.repo ?? '');
  if (!repo || !repo.includes('/')) {
    throw new ServiceFetchError('github', widgetName, 'The "repo" parameter must look like "owner/name"');
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dashboard-app',
  };
  if (auth?.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com${path}`, { headers, signal: controller.signal });
  } catch (err) {
    throw new ServiceFetchError('github', widgetName, `Could not reach GitHub API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new ServiceFetchError('github', widgetName, `GitHub API returned HTTP ${res.status}`);
  }
  return res.json();
}

const recentCommits: WidgetDefinition = {
  name: 'recent_commits',
  description: 'Display the most recent commit messages and authors for a repository',
  params: [
    { name: 'repo', type: 'string', required: true },
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
    { name: 'repo', type: 'string', required: true },
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
  params: [{ name: 'repo', type: 'string', required: true }],
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

@Injectable()
export class GithubProvider implements ServiceProvider {
  name = 'github';
  requiresAuth = true;
  widgets: WidgetDefinition[] = [recentCommits, openIssues, repoStats];
}
