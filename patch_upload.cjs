const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

const uploadImageBody = `
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "reviews",
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation: [{ width: 1000, height: 1000, crop: "limit" }]
        },
        async (error, result) => {
          if (error) {
            return reject(new AppError("Failed to upload image", 500, "UPLOAD_ERROR"));
          }
          
          try {
            await prisma.uploadTracker.create({
              data: {
                publicId: result?.public_id,
                url: result?.secure_url,
                status: "PENDING"
              }
            });
            resolve({
              url: result?.secure_url,
              public_id: result?.public_id,
              width: result?.width,
              height: result?.height
            });
          } catch (e) {
            reject(new AppError("Failed to track upload", 500, "UPLOAD_ERROR"));
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
`;

content = content.replace(/return new Promise\(\(resolve, reject\) => {[\s\S]*?uploadStream\.end\(fileBuffer\);\n    }\);/, uploadImageBody.trim());
fs.writeFileSync(file, content);
console.log("Updated uploadReviewImage in storefront review service");
