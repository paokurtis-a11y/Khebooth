import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const organizationName = process.env.SEED_ORGANIZATION_NAME;
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;

  if (!organizationName || !email || !password) {
    throw new Error(
      'SEED_ORGANIZATION_NAME, SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required',
    );
  }

  const passwordHash = await argon2.hash(password);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        passwordHash,
        role: UserRole.OWNER,
        isActive: true,
      },
    });
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: organizationName },
  });

  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email,
      passwordHash,
      role: UserRole.OWNER,
      isActive: true,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
