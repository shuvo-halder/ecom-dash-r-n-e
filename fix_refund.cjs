const fs = require('fs');
let content = fs.readFileSync('src/backend/services/refund.service.ts', 'utf-8');

content = content.replace(
  'emailService.sendRefundCompletedEmail(emailRecipient, completedTransaction, fullOrder).catch(() => {});',
  'emailService.sendRefundCompletedEmail(emailRecipient, completedTransaction, fullOrder).catch(() => {});\n        emailService.sendAdminRefundEmail(completedTransaction, fullOrder, "Completed").catch(() => {});'
);

content = content.replace(
  'emailService.sendRefundCompletedEmail(emailRecipient, completedRefund, fullOrder).catch(() => {});',
  'emailService.sendRefundCompletedEmail(emailRecipient, completedRefund, fullOrder).catch(() => {});\n        emailService.sendAdminRefundEmail(completedRefund, fullOrder, "Completed").catch(() => {});'
);

fs.writeFileSync('src/backend/services/refund.service.ts', content);
