import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import { DEFAULT_POLICIES } from "../src/policy/default-policies";

/**
 * Additive-only seed for the FashionKart demo storefront. Never wipes or
 * touches any other merchant's data — every write here is an upsert keyed
 * by a stable identifier (slug, email, product name), so running this
 * script again is safe and idempotent. FashionKart is left with no
 * razorpayKeyId/Secret configured, so it transacts through Vidur's shared
 * sandbox account (see RazorpayService.resolveCredentials) — exactly the
 * "zero setup" demo tenant the product plan calls for.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FASHIONKART_SLUG = "fashionkart";
const ADMIN_EMAIL = "admin@fashionkart.vidur.ai";
const ADMIN_PASSWORD = "FashionKart@123";
const PASSWORD_SALT_ROUNDS = 10;

const PRODUCTS: Array<{
  name: string;
  description: string;
  priceAmount: number;
  imageUrl: string;
}> = [
  {
    name: "Classic Cotton Tee",
    description: "Everyday crew-neck t-shirt in soft breathable cotton.",
    priceAmount: 799,
    imageUrl: "https://picsum.photos/seed/fashionkart-tee/600/700",
  },
  {
    name: "Denim Jacket",
    description: "Mid-wash denim jacket with a relaxed fit.",
    priceAmount: 2999,
    imageUrl: "https://picsum.photos/seed/fashionkart-denim/600/700",
  },
  {
    name: "Running Sneakers",
    description: "Lightweight cushioned sneakers built for daily runs.",
    priceAmount: 3499,
    imageUrl: "https://picsum.photos/seed/fashionkart-sneakers/600/700",
  },
  {
    name: "Formal Slim-Fit Shirt",
    description: "Wrinkle-resistant slim-fit shirt for office wear.",
    priceAmount: 1499,
    imageUrl: "https://picsum.photos/seed/fashionkart-shirt/600/700",
  },
  {
    name: "Wool Blend Sweater",
    description: "Warm crew-neck sweater in a soft wool blend.",
    priceAmount: 1999,
    imageUrl: "https://picsum.photos/seed/fashionkart-sweater/600/700",
  },
  {
    name: "Chino Trousers",
    description: "Tailored chino trousers in a comfortable stretch fabric.",
    priceAmount: 1799,
    imageUrl: "https://picsum.photos/seed/fashionkart-chino/600/700",
  },
  {
    name: "Leather Belt",
    description: "Genuine leather belt with a brushed metal buckle.",
    priceAmount: 899,
    imageUrl: "https://picsum.photos/seed/fashionkart-belt/600/700",
  },
  {
    name: "Everyday Backpack",
    description: "Water-resistant backpack with a padded laptop sleeve.",
    priceAmount: 2499,
    imageUrl: "https://picsum.photos/seed/fashionkart-backpack/600/700",
  },
  {
    name: "Aviator Sunglasses",
    description: "UV-protected aviator sunglasses with metal frames.",
    priceAmount: 1299,
    imageUrl: "https://picsum.photos/seed/fashionkart-sunglasses/600/700",
  },
  {
    name: "Canvas Sneaker Slip-Ons",
    description: "Casual slip-on canvas sneakers for everyday wear.",
    priceAmount: 1199,
    imageUrl: "https://picsum.photos/seed/fashionkart-slipons/600/700",
  },
];

async function main() {
  console.log("Seeding FashionKart demo storefront (additive, idempotent)...");

  const merchant = await prisma.merchant.upsert({
    where: { slug: FASHIONKART_SLUG },
    update: { isDemoMerchant: true },
    create: {
      name: "FashionKart",
      email: "hello@fashionkart.vidur.ai",
      slug: FASHIONKART_SLUG,
      currency: "INR",
      isDemoMerchant: true,
    },
  });
  console.log(`Merchant ready: ${merchant.id} (slug=${merchant.slug})`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, PASSWORD_SALT_ROUNDS);

  await prisma.merchantUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      merchantId: merchant.id,
      name: "FashionKart Admin",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin login ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  const existingPolicyCount = await prisma.policy.count({
    where: { merchantId: merchant.id },
  });

  if (existingPolicyCount === 0) {
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
        retryIntervalMinutes: policy.retryIntervalMinutes ?? null,
        enabled: true,
      })),
    });
    console.log(`Policies seeded: ${DEFAULT_POLICIES.length}.`);
  } else {
    console.log("Policies already present; leaving as-is.");
  }

  for (const product of PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { merchantId: merchant.id, name: product.name },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: product.description,
          priceAmount: product.priceAmount,
          imageUrl: product.imageUrl,
          active: true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          merchantId: merchant.id,
          name: product.name,
          description: product.description,
          priceAmount: product.priceAmount,
          imageUrl: product.imageUrl,
          currency: "INR",
          active: true,
        },
      });
    }
  }
  console.log(`Products upserted: ${PRODUCTS.length}.`);

  console.log("FashionKart seed complete.");
  console.log(`Storefront: /store/${FASHIONKART_SLUG}`);
  console.log(`Merchant dashboard login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("FashionKart seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
