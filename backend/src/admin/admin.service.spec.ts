import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

function makePrismaMock() {
  return {
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    session: { deleteMany: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeMailMock() {
  return { sendAlertEmail: jest.fn().mockResolvedValue(undefined) };
}

describe('AdminService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let mail: ReturnType<typeof makeMailMock>;
  let service: AdminService;

  beforeEach(() => {
    prisma = makePrismaMock();
    mail = makeMailMock();
    service = new AdminService(prisma as any, mail as any);
  });

  describe('listUsers', () => {
    it('flattens Prisma\'s _count into plain fields, never exposing passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@example.com',
          passwordHash: 'should-never-appear',
          firstName: 'Ada',
          lastName: null,
          emailVerified: true,
          isAdmin: false,
          isBanned: false,
          banReason: null,
          createdAt: new Date('2026-01-01'),
          _count: { widgetInstances: 2, oauthAccounts: 1, sessions: 3 },
        },
      ]);

      const result = await service.listUsers();

      expect(result).toEqual([
        {
          id: 'u1',
          email: 'a@example.com',
          firstName: 'Ada',
          lastName: null,
          emailVerified: true,
          isAdmin: false,
          isBanned: false,
          banReason: null,
          createdAt: new Date('2026-01-01'),
          widgetCount: 2,
          linkedAccountsCount: 1,
          sessionCount: 3,
        },
      ]);
    });
  });

  describe('ban', () => {
    it('404s on an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.ban('nope', 'admin-1', 'spamming')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to let an admin ban themselves', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', isAdmin: true });
      await expect(service.ban('admin-1', 'admin-1', 'spamming')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to ban another admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: true });
      await expect(service.ban('u2', 'admin-1', 'spamming')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a missing or blank reason, before even looking the user up', async () => {
      await expect(service.ban('u2', 'admin-1', '')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.ban('u2', 'admin-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('sets isBanned + banReason and deletes every session for the target, in one transaction, then emails them', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: false, email: 'u2@example.com', language: 'fr' });

      await service.ban('u2', 'admin-1', 'Spamming the same RSS link from many accounts');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { isBanned: true, banReason: 'Spamming the same RSS link from many accounts' },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u2' } });
      expect(mail.sendAlertEmail).toHaveBeenCalledWith(
        'u2@example.com',
        expect.any(String),
        expect.stringContaining('Spamming the same RSS link from many accounts'),
      );
    });

    it('still bans even if the notification email fails to send', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: false, email: 'u2@example.com', language: 'en' });
      mail.sendAlertEmail.mockRejectedValue(new Error('smtp down'));
      await expect(service.ban('u2', 'admin-1', 'reason')).resolves.toBeUndefined();
    });
  });

  describe('remove', () => {
    it('refuses a missing or blank reason, before even looking the user up', async () => {
      await expect(service.remove('u2', 'admin-1', '')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.remove('u2', 'admin-1', '   ')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('refuses to let an admin delete themselves', async () => {
      await expect(service.remove('admin-1', 'admin-1', 'reason')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('404s on an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.remove('nope', 'admin-1', 'reason')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to delete another admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: true });
      await expect(service.remove('u2', 'admin-1', 'reason')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('emails the target the reason, then deletes a non-admin target', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: false, email: 'u2@example.com', language: 'en' });
      await service.remove('u2', 'admin-1', 'Repeated harassment reported by other users');
      expect(mail.sendAlertEmail).toHaveBeenCalledWith(
        'u2@example.com',
        expect.any(String),
        expect.stringContaining('Repeated harassment reported by other users'),
      );
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
    });

    it('still deletes even if the notification email fails to send', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', isAdmin: false, email: 'u2@example.com', language: 'en' });
      mail.sendAlertEmail.mockRejectedValue(new Error('smtp down'));
      await expect(service.remove('u2', 'admin-1', 'reason')).resolves.toBeUndefined();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
    });
  });

  describe('unban', () => {
    it('404s on an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.unban('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears isBanned and banReason, then emails the user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'u2@example.com', language: 'es' });
      await service.unban('u2');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { isBanned: false, banReason: null } });
      expect(mail.sendAlertEmail).toHaveBeenCalledWith('u2@example.com', expect.any(String), expect.any(String));
    });
  });

  describe('updateUser', () => {
    it('404s on an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUser('nope', { firstName: 'A' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty update', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      await expect(service.updateUser('u2', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a blank name', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      await expect(service.updateUser('u2', { firstName: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates name and manually flips emailVerified, never touching isAdmin/isBanned/password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      prisma.user.update.mockResolvedValue({
        id: 'u2',
        email: 'a@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        emailVerified: true,
        isAdmin: false,
        isBanned: false,
      });

      const result = await service.updateUser('u2', { firstName: 'Grace', lastName: 'Hopper', emailVerified: true });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u2' },
        data: { firstName: 'Grace', lastName: 'Hopper', emailVerified: true },
      });
      expect(result).toEqual({
        id: 'u2',
        email: 'a@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        emailVerified: true,
        isAdmin: false,
        isBanned: false,
      });
    });
  });
});
