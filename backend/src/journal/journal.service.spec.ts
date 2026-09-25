import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { JournalService } from './journal.service';

function makePrismaMock() {
  return {
    journalEntry: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
}

function makeConfigMock(values: Record<string, string> = { TOKEN_ENCRYPTION_KEY: 'a'.repeat(64) }) {
  return { get: jest.fn((key: string): string | undefined => values[key]) };
}

describe('JournalService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let config: ReturnType<typeof makeConfigMock>;
  let service: JournalService;

  beforeEach(() => {
    prisma = makePrismaMock();
    config = makeConfigMock();
    service = new JournalService(prisma as any, config as any);
  });

  describe('create + list', () => {
    it('round-trips text through encryption (list returns the original plaintext)', async () => {
      let stored: any;
      prisma.journalEntry.create.mockImplementation(({ data }: any) => {
        stored = { id: 'entry-1', date: data.date, mood: data.mood, textEncrypted: data.textEncrypted, createdAt: new Date(), updatedAt: new Date() };
        return Promise.resolve(stored);
      });
      const created = await service.create('user-1', { mood: '🥰', text: 'Dear journal, today was good.' });
      expect(created.text).toBe('Dear journal, today was good.');
      expect(stored.textEncrypted).not.toContain('Dear journal');

      prisma.journalEntry.findMany.mockResolvedValue([stored]);
      const [listed] = await service.list('user-1');
      expect(listed.text).toBe('Dear journal, today was good.');
    });

    it('rejects an invalid date', async () => {
      await expect(service.create('user-1', { date: 'not-a-date', text: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('rejects when the server has no TOKEN_ENCRYPTION_KEY configured', async () => {
      config = makeConfigMock({});
      service = new JournalService(prisma as any, config as any);
      await expect(service.create('user-1', { text: 'x' })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects when the entry does not belong to this user', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);
      await expect(service.update('user-1', 'entry-1', { text: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty update', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      await expect(service.update('user-1', 'entry-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-encrypts new text and updates mood', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      prisma.journalEntry.update.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'entry-1', date: new Date(), mood: data.mood, textEncrypted: data.textEncrypted, createdAt: new Date(), updatedAt: new Date() }),
      );
      const updated = await service.update('user-1', 'entry-1', { mood: '😴', text: 'Sleepy now.' });
      expect(updated.mood).toBe('😴');
      expect(updated.text).toBe('Sleepy now.');
    });
  });

  describe('remove', () => {
    it('rejects when the entry does not belong to this user', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);
      await expect(service.remove('user-1', 'entry-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.journalEntry.delete).not.toHaveBeenCalled();
    });

    it('deletes an owned entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue({ id: 'entry-1' });
      await service.remove('user-1', 'entry-1');
      expect(prisma.journalEntry.delete).toHaveBeenCalledWith({ where: { id: 'entry-1' } });
    });
  });
});
