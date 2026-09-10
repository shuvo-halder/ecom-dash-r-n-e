const { sanitizeRichText } = require('./src/backend/utils/richTextSanitizer.ts');
console.log("No style:", sanitizeRichText('<p>Normal text</p>'));
console.log("With hex:", sanitizeRichText('<p><span style="color: #64748b">Explicit color</span></p>'));
console.log("With hsl:", sanitizeRichText('<p><span style="color: hsl(var(--muted-foreground))">Pasted color</span></p>'));
console.log("With class:", sanitizeRichText('<p class="text-gray-500">Pasted class</p>'));
