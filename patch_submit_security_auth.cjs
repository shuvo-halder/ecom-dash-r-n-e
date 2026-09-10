const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const imagesWithPublicIds = \(payload\.images \|\| \[\]\)\.map\(url => \{\s*const tracker = imageTrackerRecords\.find\(t => t\.url === url\);\s*return \{\s*url,\s*cloudinaryPublicId: tracker \? tracker\.publicId : null\s*\};\s*\}\);/,
  `const imagesWithPublicIds = imageTrackerRecords.map(tracker => ({ url: tracker.url, cloudinaryPublicId: tracker.publicId }));`
);

fs.writeFileSync(file, content);
console.log("Patched auth submit review image mapping");
