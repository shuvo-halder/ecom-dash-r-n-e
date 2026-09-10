import fs from 'fs';

const files = [
  'src/pages/admin/customers/CustomerDetail.tsx',
  'src/pages/admin/customers/CustomersList.tsx'
];

for (const file of files) {
  let data = fs.readFileSync(file, 'utf8');
  // Specifically remove title from lucide icons
  data = data.replace(/(<(?:CheckCircle|AlertCircle|XCircle|Eye|FileText|Key)\b[^>]*)\s+title="[^"]*"/g, '$1');
  fs.writeFileSync(file, data);
}
