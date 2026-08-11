import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password) {
    throw new Error('SEED_OWNER_PASSWORD is required to run the seed safely.');
  }

  const email = (process.env.SEED_OWNER_EMAIL ?? 'owner@khebooth.local').trim().toLowerCase();
  const organizationName = process.env.SEED_ORGANIZATION_NAME ?? 'Kurtis Hypnotic Events';
  const passwordHash = await argon2.hash(password);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash, role: UserRole.OWNER, isActive: true },
    });
    return;
  }

  await prisma.organization.create({
    data: {
      name: organizationName,
      users: {
        create: {
          email,
          passwordHash,
          role: UserRole.OWNER,
          isActive: true,
        },
      },
      presets: {
        create: [
          { name: 'Portrait MVP', aspectRatio: 'PORTRAIT_9_16' },
          { name: 'Square MVP', aspectRatio: 'SQUARE_1_1' },
        ],
      },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
