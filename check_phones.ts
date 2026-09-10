import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const customers = await prisma.customer.findMany({
    select: { id: true, phone: true }
  });
  console.log('Total customers:', customers.length);
  const phones = customers.map(c => c.phone).filter(Boolean);
  console.log('With phone:', phones.length);
  console.dir(phones, { maxArrayLength: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
