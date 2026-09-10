const fs = require('fs');
const file = '/app/applet/src/backend/__tests__/otp.test.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('prisma.$transaction = async (arr) => {')) {
  const mockInsert = `
(prisma as any).$transaction = async (arr: any[]) => {
  const results = [];
  for (const p of arr) {
    results.push(await p);
  }
  return results;
};
`;
  code = code.replace('(prisma.customerOtp as any) = {', mockInsert + '\n(prisma.customerOtp as any) = {');
  fs.writeFileSync(file, code);
  console.log('Patched otp.test.ts');
}
