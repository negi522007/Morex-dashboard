import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptToken, encryptToken } from '../common/token-encryption.util';

export interface JournalEntryDto {
  id: string;
  date: Date;
  mood: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

// Entries are private by design ("just for you" in the UI) — text is
// encrypted at rest with the same AES-256-GCM utility used for OAuth
// tokens, decrypted only when read back for the owning user.
@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!key) {
      throw new ServiceUnavailableException('Journal encryption is not configured on the server');
    }
    return key;
  }

  private toDto(entry: { id: string; date: Date; mood: string; textEncrypted: string; createdAt: Date; updatedAt: Date }): JournalEntryDto {
    return {
      id: entry.id,
      date: entry.date,
      mood: entry.mood,
      text: decryptToken(entry.textEncrypted, this.encryptionKey()),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async list(userId: string): Promise<JournalEntryDto[]> {
    const entries = await this.prisma.journalEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } });
    return entries.map((e) => this.toDto(e));
  }

  async create(userId: string, body: { date?: string; mood?: string; text?: string }): Promise<JournalEntryDto> {
    const mood = body.mood ?? '😊';
    const text = body.text ?? '';
    const date = body.date ? new Date(body.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const entry = await this.prisma.journalEntry.create({
      data: { userId, date, mood, textEncrypted: encryptToken(text, this.encryptionKey()) },
    });
    return this.toDto(entry);
  }

  async update(userId: string, id: string, body: { mood?: string; text?: string }): Promise<JournalEntryDto> {
    const existing = await this.prisma.journalEntry.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException('Journal entry not found');
    }

    const data: { mood?: string; textEncrypted?: string } = {};
    if (body.mood !== undefined) data.mood = body.mood;
    if (body.text !== undefined) data.textEncrypted = encryptToken(body.text, this.encryptionKey());

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update: provide mood and/or text');
    }

    const updated = await this.prisma.journalEntry.update({ where: { id: existing.id }, data });
    return this.toDto(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.journalEntry.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException('Journal entry not found');
    }
    await this.prisma.journalEntry.delete({ where: { id: existing.id } });
  }
}
