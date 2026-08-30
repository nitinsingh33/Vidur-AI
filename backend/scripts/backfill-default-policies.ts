import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { DEFAULT_POLICIES } from '../src/policy/default-policies';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * One-off backfill for merchants created before AuthService.signup()
 * started seeding default policies. Only touches merchants that
 * currently have zero Policy rows — never overwrites a merchant's own
 * customized policies.
 */
async function main() {
  const merchants = await prisma.merchant.findMany({
    select: { id: true, name: true, email: true },
  });

  let backfilled = 0;

  for (const merchant of merchants) {
    const existingCount = await prisma.policy.count({
      where: { merchantId: merchant.id },
    });

    if (existingCount > 0) {
      continue;
    }

    await prisma.policy.createMany({
      data: DEFAULT_POLICIES.map((policy) => ({
        merchantId: merchant.id,
        name: policy.name,
        description: policy.description,
        actionType: policy.actionType,
        decision: policy.decision,
        maxRetries: policy.maxRetries ?? null,
        maxContacts: policy.maxContacts ?? null,
        maxAmount: policy.maxAmount ?? null,
        enabled: true,
      })),
    });

    backfilled += 1;
    console.log(`Backfilled policies for ${merchant.email} (${merchant.name})`);
  }

  console.log(
    `Done. ${backfilled} of ${merchants.length} merchants backfilled.`,
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
