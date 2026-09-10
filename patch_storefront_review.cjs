const fs = require('fs');
let code = fs.readFileSync('src/backend/services/storefront/review.service.ts', 'utf8');

const buggyImageLogic = `
      // Map images to their publicIds
      const imageTrackerRecords = await tx.uploadTracker.findMany({
        where: {
          url: { in: payload.images || [] },
          status: "PENDING"
        }
      });
      const imagesWithPublicIds = imageTrackerRecords.map(tracker => ({ url: tracker.url, cloudinaryPublicId: tracker.publicId }));
`.trim();

const fixedImageLogic = `
      // Atomic locking of UploadTrackers to prevent reuse across concurrent requests
      let imageTrackerRecords = [];
      if (payload.images && payload.images.length > 0) {
        const lockResult = await tx.uploadTracker.updateMany({
          where: {
            url: { in: payload.images },
            status: "PENDING"
          },
          data: { status: "ATTACHED" }
        });
        
        if (lockResult.count !== payload.images.length) {
          throw new AppError("One or more images are invalid or have already been attached", 400, "INVALID_IMAGES");
        }
        
        imageTrackerRecords = await tx.uploadTracker.findMany({
          where: {
            url: { in: payload.images },
            status: "ATTACHED"
          }
        });
      }
      const imagesWithPublicIds = imageTrackerRecords.map(tracker => ({ url: tracker.url, cloudinaryPublicId: tracker.publicId }));
`.trim();

const buggyStatusUpdate = `
        if (imageTrackerRecords.length > 0) {
          await tx.uploadTracker.updateMany({
            where: { id: { in: imageTrackerRecords.map(t => t.id) } },
            data: { status: "ATTACHED" }
          });
        }
`.trim();

// Because the file has two instances of the buggy logic (one for guest, one for authenticated)
if (code.includes(buggyImageLogic)) {
  code = code.split(buggyImageLogic).join(fixedImageLogic);
  code = code.split(buggyStatusUpdate).join('');
  fs.writeFileSync('src/backend/services/storefront/review.service.ts', code);
  console.log("Patched successfully.");
} else {
  console.log("Could not find exact buggy logic.");
}
