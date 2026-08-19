import { PrismaClient } from '@prisma/client';
import { hashPassword } from './utils/hash.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with default admin user...');
  
  const username = 'Administrator';
  const plainPassword = 'password123';
  const hashedPassword = hashPassword(plainPassword);
  
  const user = await prisma.user.upsert({
    where: { username },
    update: {
      password: hashedPassword,
      isStaff: true,
      isSuperuser: true
    },
    create: {
      username,
      password: hashedPassword,
      email: 'admin@inventree.local',
      isStaff: true,
      isSuperuser: true
    }
  });
  
  console.log(`Successfully created or updated default admin user: ${user.username} (ID: ${user.id})`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
