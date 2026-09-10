const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace guest review image mapping
content = content.replace(
  /const imagesWithPublicIds = \(payload\.images \|\| \[\]\)\.map\(url => \{\s*const tracker = imageTrackerRecords\.find\(t => t\.url === url\);\s*return \{\s*url,\s*cloudinaryPublicId: tracker \? tracker\.publicId : null\s*\};\s*\}\);/,
  `const imagesWithPublicIds = imageTrackerRecords.map(tracker => ({ url: tracker.url, cloudinaryPublicId: tracker.publicId }));`
);

// We need to do it globally since it appears twice (once in guest, once in authenticated)
fs.writeFileSync(file, content);
console.log("Patched submit reviews image mapping");
