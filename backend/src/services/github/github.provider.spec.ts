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
    expect(provider.widgets.map((w) => w.name).sort()).toEqual(['open_issues', 'recent_commits', 'repo_stats']);
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
});
