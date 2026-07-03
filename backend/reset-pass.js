const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Usage: node reset-pass.js <email> [newPassword]
// Generates a random password if none is supplied — never hardcode a real credential here.
async function main() {
  const email = process.argv[2];
  let newPassword = process.argv[3];

  if (!email) {
    console.error('❌ Provide an email: node reset-pass.js <email> [newPassword]');
    process.exit(1);
  }

  let generated = false;
  if (!newPassword) {
    newPassword = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
  });

  console.log(`✅ Password reset for ${email}`);
  if (generated) {
    console.log(`   Generated password (save it now, it won't be shown again): ${newPassword}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
