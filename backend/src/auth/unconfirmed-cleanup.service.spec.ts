import { UnconfirmedCleanupService } from './unconfirmed-cleanup.service';

describe('UnconfirmedCleanupService', () => {
  it('deletes only unconfirmed accounts older than the token lifetime', async () => {
    const prisma: any = { user: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    expect(await new UnconfirmedCleanupService(prisma).purge()).toBe(2);
    const where = prisma.user.deleteMany.mock.calls[0][0].where;
    expect(where.emailVerified).toBe(false);
    const cutoff = where.createdAt.lt.getTime();
    expect(Date.now() - cutoff).toBeGreaterThanOrEqual(24 * 3600_000 - 1000);
    expect(Date.now() - cutoff).toBeLessThan(24 * 3600_000 + 5000);
  });
});
