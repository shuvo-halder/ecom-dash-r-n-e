const fs = require('fs');
const file = 'src/backend/utils/richTextSanitizer.ts';
let code = fs.readFileSync(file, 'utf8');

const target = "attribs.style = attribs.style.replace(/color:\\s*(gray|hsl\\([^)]+\\)|var\\([^)]+\\)|hsl\\(var\\([^)]+\\)\\)|rgb\\(\\s*100\\s*,\\s*116\\s*,\\s*139\\s*\\)|rgb\\(\\s*107\\s*,\\s*114\\s*,\\s*128\\s*\\))\\s*(;|$)/gi, '').replace(/\\s+/g, ' ').trim();";
const replacement = "attribs.style = attribs.style.replace(/color:\\s*(?![#][0-9a-fA-F]{3,6}\\b)[^;]+(;|$)/gi, '').replace(/\\s+/g, ' ').trim();";

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Patched regex to only allow Hex');
} else {
  console.log('Target not found');
}
