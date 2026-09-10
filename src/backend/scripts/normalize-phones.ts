import { PrismaClient } from "@prisma/client";
import { normalizePhone } from "../utils/phone";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting mobile number normalization process...");

  const customers = await prisma.customer.findMany({
    where: {
      phone: { not: null },
    },
    select: { id: true, phone: true, email: true },
  });

  console.log(`Found ${customers.length} customers with a phone number.`);

  const phoneMap = new Map<string, string[]>();
  let updatedCount = 0;
  let nulledCount = 0;
  let conflictCount = 0;

  for (const customer of customers) {
    if (!customer.phone) continue;

    const normalized = normalizePhone(customer.phone);

    if (!normalized) {
      console.log(`[Invalid] Customer ${customer.email} (ID: ${customer.id}) has invalid phone: ${customer.phone}. Setting to null.`);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { phone: null },
      });
      nulledCount++;
      continue;
    }

    if (phoneMap.has(normalized)) {
      console.log(`[Conflict] Customer ${customer.email} (ID: ${customer.id}) has conflicting phone: ${normalized} (Original: ${customer.phone}). Setting to null to avoid unique constraint failure.`);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { phone: null },
      });
      conflictCount++;
    } else {
      phoneMap.set(normalized, [customer.id]);

      // Only update if the string value actually changed
      if (normalized !== customer.phone) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { phone: normalized },
        });
        updatedCount++;
      }
    }
  }

  console.log("Normalization complete.");
  console.log(`Total processed: ${customers.length}`);
  console.log(`Successfully normalized: ${updatedCount}`);
  console.log(`Invalid numbers cleared (set to null): ${nulledCount}`);
  console.log(`Conflicts cleared (set to null): ${conflictCount}`);
  console.log(`Final unique valid phone numbers: ${phoneMap.size}`);
}

main()
  .catch((e) => {
    console.error("Error during normalization:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
