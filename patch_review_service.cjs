const fs = require('fs');
let file = fs.readFileSync('src/backend/services/review.service.ts', 'utf8');

if (!file.includes('config/cloudinary')) {
    file = file.replace('import { AppError } from "../utils/AppError";', 'import { AppError } from "../utils/AppError";\nimport { cloudinary, isCloudinaryConfigured } from "../config/cloudinary";');
}

const targetDelete = `  static async deleteReview(id: string) {
    await prisma.review.delete({
      where: { id }
    });
    return { success: true };
  }`;

const replacementDelete = `  static async deleteReview(id: string) {
    // 1. Fetch Review + ReviewImages
    const review = await prisma.review.findUnique({
      where: { id },
      include: { images: true }
    });

    if (!review) {
      throw new AppError("Review not found", 404, "NOT_FOUND");
    }

    // 2. Delete DB Record
    await prisma.review.delete({
      where: { id }
    });

    // 3. Attempt Cloudinary cleanup safely outside transaction
    if (isCloudinaryConfigured()) {
      for (const image of review.images) {
        if (image.cloudinaryPublicId) {
          try {
            await cloudinary.uploader.destroy(image.cloudinaryPublicId);
          } catch (error: any) {
            console.error(\`[Cloudinary Cleanup Failed] Review: \${id}, PublicID: \${image.cloudinaryPublicId}, Error: \${error.message}\`);
          }
        }
      }
    }

    return { success: true };
  }`;

if (file.includes('static async deleteReview(id: string) {')) {
    file = file.replace(targetDelete, replacementDelete);
    fs.writeFileSync('src/backend/services/review.service.ts', file);
    console.log("Patched successfully");
} else {
    console.log("Could not find deleteReview method.");
}
