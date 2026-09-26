import { AiService, AiUnavailableError, extractJson } from './ai.service';

function make(env: Record<string, string>, calls = 1) {
  const prisma = {
    aiUsage: {
      upsert: jest.fn().mockImplementation(async () => ({ calls })),
      findUnique: jest.fn(),
    },
  };
  const config = { get: (k: string) => env[k] };
  return { svc: new AiService(config as any, prisma as any), prisma };
}

describe('extractJson', () => {
  it('parses fenced and prefixed output', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('[1,2]')).toEqual([1, 2]);
  });
  it('throws without JSON', () => {
    expect(() => extractJson('nope')).toThrow();
  });
});

describe('AiService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is unavailable without a key, and refuses to answer', async () => {
    const { svc } = make({ AI_PROVIDER: 'anthropic' });
    expect(svc.available).toBe(false);
    await expect(svc.forUser('u').completeJson({ system: 's', user: 'u' })).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('mock provider answers with the canned value and uses no quota', async () => {
    const { svc, prisma } = make({ AI_PROVIDER: 'mock' });
    expect(await svc.forUser('u').completeJson({ system: 's', user: 'u', mock: { ok: 1 } })).toEqual({ ok: 1 });
    expect(prisma.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it('calls Anthropic with the key in x-api-key and parses the JSON answer', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{"x":2}' }] }), { status: 200 }),
    );
    const { svc } = make({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-test' });
    expect(await svc.forUser('u').completeJson({ system: 's', user: 'u' })).toEqual({ x: 2 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
  });

  it('supports an OpenAI-compatible base URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"y":3}' } }] }), { status: 200 }),
    );
    const { svc } = make({ AI_PROVIDER: 'openai-compatible', AI_API_KEY: 'k', AI_BASE_URL: 'http://llm.local/v1/' });
    expect(await svc.forUser('u').completeJson({ system: 's', user: 'u' })).toEqual({ y: 3 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://llm.local/v1/chat/completions');
  });

  it('sends reasoning_effort only when configured', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"y":1}' } }] })));
    await make({ AI_PROVIDER: 'openai-compatible', AI_API_KEY: 'k' }).svc.forUser('u').completeJson({ system: 's', user: 'u' });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).not.toHaveProperty('reasoning_effort');
    await make({ AI_PROVIDER: 'openai-compatible', AI_API_KEY: 'k', AI_REASONING_EFFORT: 'low' }).svc.forUser('u').completeJson({ system: 's', user: 'u' });
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).reasoning_effort).toBe('low');
  });

  it('stops at the daily cap without calling the provider', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { svc } = make({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'k', AI_DAILY_CALLS_PER_USER: '5' }, 6);
    await expect(svc.forUser('u').completeJson({ system: 's', user: 'u' })).rejects.toMatchObject({ reason: 'quota' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns provider failures into AiUnavailableError without leaking the key', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('no', { status: 500 }));
    const { svc } = make({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-secret' });
    const err: any = await svc.forUser('u').completeJson({ system: 's', user: 'u' }).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(String(err.message)).not.toContain('sk-secret');
  });
});
