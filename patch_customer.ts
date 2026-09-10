import fs from 'fs';

const file = 'src/backend/controllers/customer.controller.ts';
let data = fs.readFileSync(file, 'utf8');

// Helper to remove sensitive fields
const sanitizeSnippet = `
const sanitizeCustomer = (cust: any) => {
  const { passwordHash, resetPasswordToken, resetPasswordExpires, verificationToken, verificationExpires, ...safeCust } = cust;
  return safeCust;
};
`;

if (!data.includes('sanitizeCustomer')) {
  data = data.replace('export const getCustomers', sanitizeSnippet + '\nexport const getCustomers');
}

data = data.replace(
  'const { orders, ...rest } = cust;',
  'const { orders, ...rest } = sanitizeCustomer(cust);'
);

data = data.replace(
  'const { orders, reviews, customerNotes, ...rest } = customer;',
  'const { orders, reviews, customerNotes, ...rest } = sanitizeCustomer(customer);'
);

fs.writeFileSync(file, data);
