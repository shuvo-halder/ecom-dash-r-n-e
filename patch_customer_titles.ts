import fs from 'fs';

const files = [
  'src/pages/admin/customers/CustomerDetail.tsx',
  'src/pages/admin/customers/CustomersList.tsx'
];

for (const file of files) {
  let data = fs.readFileSync(file, 'utf8');
  // replace title="xyz" from lucide icons by removing them.
  data = data.replace(/ title="[^"]*"/g, '');
  fs.writeFileSync(file, data);
}
