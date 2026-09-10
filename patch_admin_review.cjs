const fs = require('fs');
let code = fs.readFileSync('src/backend/services/review.service.ts', 'utf8');

const buggyUpdate = `
    const review = await prisma.review.update({
      where: { id },
      data: { status }
    });
    return review;
`.trim();

const fixedUpdate = `
    const reviewUpdate = await prisma.review.updateMany({
      where: { id, status: existing.status },
      data: { status }
    });
    
    if (reviewUpdate.count === 0) {
      throw new AppError("Review status was modified concurrently", 409, "CONCURRENCY_ERROR");
    }
    
    return await prisma.review.findUnique({ where: { id } });
`.trim();

if (code.includes(buggyUpdate)) {
  code = code.split(buggyUpdate).join(fixedUpdate);
  fs.writeFileSync('src/backend/services/review.service.ts', code);
  console.log("Patched updateStatus successfully.");
} else {
  console.log("Could not find buggy updateStatus logic.");
}
