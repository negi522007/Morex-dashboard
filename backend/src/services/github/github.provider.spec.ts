import { GithubProvider } from './github.provider';
import { ServiceFetchError } from '../service-provider.interface';

function mockFetchOnce(response: Partial<Response>) {
  global.fetch = jest.fn().mockResolvedValue(response) as any;
}

describe('GithubProvider', () => {
  const provider = new GithubProvider();
  const recentCommits = provider.widgets.find((w) => w.name === 'recent_commits')!;
  const openIssues = provider.widgets.find((w) => w.name === 'open_issues')!;
  const repoStats = provider.widgets.find((w) => w.name === 'repo_stats')!;

  it('exposes the contract expected by /about.json, and requires auth', () => {
    expect(provider.name).toBe('github');
    expect(provider.requiresAuth).toBe(true);
    expect(provider.widgets.map((w) => w.name).sort()).toEqual(['daily_changes', 'open_issues', 'recent_commits', 'repo_stats']);
  });

  it('points every "repo" param at the repo-picker options endpoint', () => {
    for (const widget of provider.widgets) {
      const repoParam = widget.params.find((p) => p.name === 'repo');
      expect(repoParam?.optionsUrl).toBe('/services/github/repos');
    }
  });

  it('rejects a "repo" param that is not in "owner/name" form, for every widget', async () => {
    await expect(recentCommits.fetchData({ repo: 'not-a-valid-repo' })).rejects.toBeInstanceOf(ServiceFetchError);
    await expect(openIssues.fetchData({ repo: '' })).rejects.toBeInstanceOf(ServiceFetchError);
    await expect(repoStats.fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('recent_commits maps the GitHub commits shape to title/author/date', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            sha: 'abcdef1234567890',
            commit: { message: 'fix: thing\n\nlonger body', author: { name: 'Ada', date: '2024-01-01T00:00:00Z' } },
          },
        ]),
    });

    const result = (await recentCommits.fetchData({ repo: 'nestjs/nest' })) as any[];
    expect(result).toEqual([{ sha: 'abcdef1', message: 'fix: thing', author: 'Ada', date: '2024-01-01T00:00:00Z' }]);
  });

  it('recent_commits falls back to the GitHub login when the commit has no author name', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([{ sha: 'abc1234', commit: { message: 'chore: bump', author: {} }, author: { login: 'renovate-bot' } }]),
    });
    const result = (await recentCommits.fetchData({ repo: 'nestjs/nest' })) as any[];
    expect(result[0].author).toBe('renovate-bot');
  });

  it('open_issues filters out pull requests (GitHub returns both from this endpoint)', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { number: 1, title: 'A real issue', user: { login: 'alice' }, created_at: '2024-01-01T00:00:00Z' },
          { number: 2, title: 'Actually a PR', user: { login: 'bob' }, created_at: '2024-01-02T00:00:00Z', pull_request: {} },
        ]),
    });

    const result = (await openIssues.fetchData({ repo: 'nestjs/nest' })) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it('repo_stats maps stargazers/forks/open_issues counts', async () => {
    mockFetchOnce({
      ok: true,
      json: () =>
        Promise.resolve({ stargazers_count: 100, forks_count: 10, open_issues_count: 5, description: 'A repo' }),
    });

    const result = (await repoStats.fetchData({ repo: 'nestjs/nest' })) as any;
    expect(result).toEqual({ stars: 100, forks: 10, openIssues: 5, description: 'A repo' });
  });

  it('sends the Bearer token when a linked account is passed, and works without one', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stargazers_count: 1, forks_count: 0, open_issues_count: 0, description: null }),
    });
    global.fetch = fetchMock as any;

    await repoStats.fetchData({ repo: 'nestjs/nest' }, { accessToken: 'gho_linked_token' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer gho_linked_token' }) }),
    );

    fetchMock.mockClear();
    await repoStats.fetchData({ repo: 'nestjs/nest' }, undefined);
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('raises ServiceFetchError on a 404 (private or nonexistent repo) instead of throwing raw', async () => {
    mockFetchOnce({ ok: false, status: 404 });
    await expect(repoStats.fetchData({ repo: 'someone/private-repo' })).rejects.toBeInstanceOf(ServiceFetchError);
  });

  describe('listRepos', () => {
    it('maps full_name into { value, label } options', async () => {
      mockFetchOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            { full_name: 'octocat/Hello-World' },
            { full_name: 'octocat/Spoon-Knife' },
          ]),
      });

      const result = await provider.listRepos({ accessToken: 'gho_token' });

      expect(result).toEqual([
        { value: 'octocat/Hello-World', label: 'octocat/Hello-World' },
        { value: 'octocat/Spoon-Knife', label: 'octocat/Spoon-Knife' },
      ]);
    });

    it('raises ServiceFetchError on a non-2xx response instead of throwing raw', async () => {
      mockFetchOnce({ ok: false, status: 401 });
      await expect(provider.listRepos({ accessToken: 'bad_token' })).rejects.toBeInstanceOf(ServiceFetchError);
    });
  });
});

describe('GithubProvider daily_changes + metrics', () => {
  const daily = new GithubProvider().widgets.find((w) => w.name === 'daily_changes')!;

  it('summarises recent commits and uses the count as metric', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { sha: 'abcdef123', commit: { message: 'feat: a\n\nbody', author: { name: 'Ann', date: '2026-09-25T10:00:00Z' } } },
        { sha: '1234567aa', commit: { message: 'fix: b', author: { name: 'Ann', date: '2026-09-25T09:00:00Z' } } },
        { sha: '9999999aa', commit: { message: 'docs: c', author: { name: 'Bob', date: '2026-09-25T08:00:00Z' } } },
      ],
    }) as any;
    const d: any = await daily.fetchData({ repo: 'o/r', hours: 12 });
    expect(d).toMatchObject({ repo: 'o/r', hours: 12, commitCount: 3, authors: [{ name: 'Ann', count: 2 }, { name: 'Bob', count: 1 }] });
    expect(d.commits[0]).toMatchObject({ sha: 'abcdef1', message: 'feat: a' });
    expect(daily.primaryMetric!(d)).toBe(3);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/repos\/o\/r\/commits\?since=/);
  });

  it('enrich builds a stand-up from commit messages only', async () => {
    const data = { repo: 'o/r', hours: 24, commitCount: 1, authors: [], commits: [{ sha: 'a', message: 'feat: x', author: 'Ann', date: '' }] };
    const completeJson = jest.fn().mockResolvedValue({ summary: 'Did x', highlights: ['x'] });
    const out: any = await daily.enrich!(data, { userId: 'u', language: 'en', config: {}, ai: { available: true, completeJson }, cache: {} as any });
    expect(out).toMatchObject({ kind: 'standup', summary: 'Did x', highlights: ['x'] });
    expect(completeJson.mock.calls[0][0].user).not.toContain('date');
  });

  it('enrich makes no model call when nothing changed', async () => {
    const completeJson = jest.fn();
    const out: any = await daily.enrich!({ repo: 'o/r', hours: 24, commitCount: 0, authors: [], commits: [] }, { userId: 'u', language: 'en', config: {}, ai: { available: true, completeJson }, cache: {} as any });
    expect(out.highlights).toEqual([]);
    expect(completeJson).not.toHaveBeenCalled();
  });
});
