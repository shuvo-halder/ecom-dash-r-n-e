const fs = require('fs');
const file = 'src/backend/utils/richTextSanitizer.ts';
let code = fs.readFileSync(file, 'utf8');

const target = "attribs.style = attribs.style.replace(/color:\\s*(?![#][0-9a-fA-F]{3,6}\\b)[^;]+(;|$)/gi, '').replace(/\\s+/g, ' ').trim();";
const replacement = "attribs.style = attribs.style.replace(/color:\\s*(?:rgb|rgba|hsl|hsla|var|gray|transparent)[^;]*(;|$)/gi, '').replace(/\\s+/g, ' ').trim();";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Patched regex safely');
} else {
  console.log('Target not found');
}
