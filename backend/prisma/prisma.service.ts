import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly pool: Pool;
  private static readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Neon's pooled connection string closes idle sockets server-side.
    // node-postgres surfaces that as an 'error' event on the Pool; with
    // no listener, Node's default EventEmitter behavior is to crash the
    // whole process on an unhandled 'error'. The pool recovers on its
    // own (it opens a fresh connection on the next query) — this just
    // has to be observed instead of left to throw.
    pool.on('error', (error) => {
      PrismaService.logger.warn(
        `Postgres pool connection error (recovered automatically): ${error.message}`,
      );
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}
