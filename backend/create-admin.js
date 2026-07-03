require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usage: node create-admin.js [email] [password]
// Falls back to ADMIN_EMAIL / ADMIN_PASSWORD env vars, then generates a
// random password if none is supplied — never hardcode a real credential here.
async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  let password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!email) {
    console.error('❌ Provide an admin email: node create-admin.js <email> [password]');
    process.exit(1);
  }

  let generated = false;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user created/ensured: ${email}`);
  if (generated) {
    console.log(`   Generated password (save it now, it won't be shown again): ${password}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
