require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.product.findMany({ select: { description: true }, take: 2 });
  console.log(products);
}
run();
