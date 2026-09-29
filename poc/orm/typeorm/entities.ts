// POC — the same two models as backend/prisma/schema.prisma's User/WidgetInstance
// (simplified to what's relevant here), written as TypeORM entities instead of a
// Prisma schema, to compare boilerplate and the type-safety story.
import 'reflect-metadata';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @OneToMany(() => WidgetInstance, (w) => w.user)
  widgets!: WidgetInstance[];
}

@Entity('widget_instances')
export class WidgetInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  serviceName!: string;

  @Column()
  widgetName!: string;

  // Prisma: `config Json` — one line, `Record<string, string | number>` inferred by the
  // generated client automatically. TypeORM: the column type differs per database driver
  // ('jsonb' on Postgres, 'simple-json' on sqlite as used here), and the TS type on the
  // property is NOT inferred from the schema — it has to be declared by hand and can drift
  // from what's actually stored (nothing re-checks it against the column definition).
  @Column({ type: 'simple-json' })
  config!: Record<string, string | number>;

  @Column({ default: 60 })
  refreshRateSeconds!: number;

  @Column({ type: 'datetime', nullable: true })
  lastRefreshedAt!: Date | null;

  @ManyToOne(() => User, (u) => u.widgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}
