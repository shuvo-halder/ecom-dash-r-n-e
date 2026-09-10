const fs = require('fs');
let code = fs.readFileSync('src/backend/services/review.service.ts', 'utf8');

const buggyDelete = `
    // 2. Delete DB Record
    await prisma.review.delete({
      where: { id }
    });
`.trim();

const fixedDelete = `
    // 2. Delete DB Record
    try {
      await prisma.review.delete({
        where: { id }
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        // Already deleted concurrently
        return { success: true };
      }
      throw e;
    }
`.trim();

if (code.includes(buggyDelete)) {
  code = code.split(buggyDelete).join(fixedDelete);
  fs.writeFileSync('src/backend/services/review.service.ts', code);
  console.log("Patched deleteReview successfully.");
} else {
  console.log("Could not find buggy deleteReview logic.");
}
