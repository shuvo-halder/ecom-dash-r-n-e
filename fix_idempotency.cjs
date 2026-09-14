const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/paymentSecurity.service.ts', 'utf-8');

content = content.replace(
  'if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED) {',
  'if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.REFUNDED || payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELLED) {'
);

content = content.replace(
  'payment.status === PaymentStatus.REFUNDED\n              ? "Payment is already in terminal REFUNDED status"\n              : "Payment is already marked as PAID",',
  'payment.status === PaymentStatus.REFUNDED ? "Payment is already in terminal REFUNDED status" : payment.status === PaymentStatus.FAILED ? "Payment is already in terminal FAILED status" : payment.status === PaymentStatus.CANCELLED ? "Payment is already in terminal CANCELLED status" : "Payment is already marked as PAID",'
);

fs.writeFileSync('src/backend/services/storefront/paymentSecurity.service.ts', content);
