const fs = require('fs');
const file = 'src/backend/services/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethods = `
  static async updateStatus(id: string, status: "APPROVED" | "REJECTED" | "HIDDEN") {
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw new AppError("Review not found", 404, "NOT_FOUND");
    
    // Status transition rules (P1 rules)
    // A status update must never accidentally expose a non-approved review through the public API.
    // PENDING -> APPROVED
    // PENDING -> REJECTED
    // APPROVED -> HIDDEN
    // APPROVED -> REJECTED
    // REJECTED -> APPROVED 
    // HIDDEN -> APPROVED
    
    // Enforcing basic transition rules
    const validTransitions = {
      "PENDING": ["APPROVED", "REJECTED"],
      "APPROVED": ["HIDDEN", "REJECTED"],
      "REJECTED": ["APPROVED"],
      "HIDDEN": ["APPROVED"]
    };

    if (!validTransitions[existing.status].includes(status)) {
       throw new AppError(\`Cannot transition from \${existing.status} to \${status}\`, 400, "INVALID_TRANSITION");
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status }
    });
    return review;
  }

  static async updateAdminResponse(id: string, adminResponse: string | null) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");

    return await prisma.review.update({
      where: { id },
      data: { adminResponse }
    });
  }
`;

content = content.replace(/static async updateStatus[\s\S]*?return review;\n  }/, newMethods.trim());
fs.writeFileSync(file, content);
console.log("Updated review.service.ts");
