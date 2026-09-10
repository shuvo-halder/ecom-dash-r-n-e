const fs = require('fs');
const file = 'src/backend/utils/richTextSanitizer.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    transformTags: {
      a: (tagName, attribs) => {`;
const replacement = `    transformTags: {
      '*': (tagName, attribs) => {
        if (attribs.class) {
          attribs.class = attribs.class.replace(/\\b(text-gray-\\d+|text-muted-foreground|text-foreground|text-slate-\\d+|text-zinc-\\d+|text-neutral-\\d+)\\b/g, '').replace(/\\s+/g, ' ').trim();
          if (!attribs.class) delete attribs.class;
        }
        if (attribs.style) {
          attribs.style = attribs.style.replace(/color:\\s*(hsl\\([^)]+\\)|var\\([^)]+\\)|rgb\\(\\s*100\\s*,\\s*116\\s*,\\s*139\\s*\\)|rgb\\(\\s*107\\s*,\\s*114\\s*,\\s*128\\s*\\))\\s*(;|$)/gi, '').replace(/\\s+/g, ' ').trim();
          if (!attribs.style) delete attribs.style;
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Patched richTextSanitizer.ts');
} else {
  console.log('Target not found in richTextSanitizer.ts');
}
