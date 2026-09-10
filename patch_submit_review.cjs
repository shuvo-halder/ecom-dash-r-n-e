const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Function to replace image creation logic
function replaceImageLogic(source) {
  return source.replace(/images: {\s*create: \(payload\.images \|\| \[\]\)\.map\(\(url\) => \(\{\s*url\s*\}\)\),\s*},/g, `
            images: {
              create: imagesWithPublicIds,
            },
  `.trim());
}

// In submitGuestReview
content = content.replace(/try {\n\s*const review = await tx\.review\.create\({/g, `
      // Map images to their publicIds
      const imageTrackerRecords = await tx.uploadTracker.findMany({
        where: {
          url: { in: payload.images || [] },
          status: "PENDING"
        }
      });
      const imagesWithPublicIds = (payload.images || []).map(url => {
        const tracker = imageTrackerRecords.find(t => t.url === url);
        return {
          url,
          cloudinaryPublicId: tracker ? tracker.publicId : null
        };
      });

      try {
        const review = await tx.review.create({
`);

content = content.replace(/images: \{\s*create: \(payload\.images \|\| \[\]\)\.map\(\(url\) => \(\{\s*url\s*\}\)\),\s*\},\s*\},\s*\}\);/g, `
            images: {
              create: imagesWithPublicIds,
            },
          },
        });
        
        if (imageTrackerRecords.length > 0) {
          await tx.uploadTracker.updateMany({
            where: { id: { in: imageTrackerRecords.map(t => t.id) } },
            data: { status: "ATTACHED" }
          });
        }
`);

fs.writeFileSync(file, content);
console.log("Updated submitReview in storefront review service");
