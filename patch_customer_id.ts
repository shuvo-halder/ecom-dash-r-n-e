import fs from 'fs';
const file = 'src/backend/controllers/customer.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /...customer,/g,
  '...sanitizeCustomer(customer),'
);

fs.writeFileSync(file, data);
