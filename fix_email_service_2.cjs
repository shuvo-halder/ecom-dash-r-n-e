const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// Need to make getStoreName public for the test endpoint
content = content.replace(
  `private async getStoreName()`,
  `public async getStoreName()`
);

// We need to inject the storeName into all the email send methods
// Let's do a massive replace to inject it

content = content.replace(/const mailOptions = \{/g, `const storeName = await this.getStoreName();\n    const mailOptions = {`);

// Now replace all the template calls
content = content.replace(/getVerificationEmailHtml\((.*)\),/g, `getVerificationEmailHtml($1, storeName),`);
content = content.replace(/getEmailChangeHtml\((.*)\),/g, `getEmailChangeHtml($1, storeName),`);
content = content.replace(/getPasswordResetHtml\((.*)\),/g, `getPasswordResetHtml($1, storeName),`);
content = content.replace(/getOrderConfirmationHtml\((.*)\),/g, `getOrderConfirmationHtml($1, storeName),`);
content = content.replace(/getOrderProcessingHtml\((.*)\),/g, `getOrderProcessingHtml($1, storeName),`);
content = content.replace(/getOrderConfirmedHtml\((.*)\),/g, `getOrderConfirmedHtml($1, storeName),`);
content = content.replace(/getOrderCancelledHtml\((.*)\),/g, `getOrderCancelledHtml($1, storeName),`);
content = content.replace(/getPaymentSuccessHtml\((.*)\),/g, `getPaymentSuccessHtml($1, storeName),`);
content = content.replace(/getPaymentFailedHtml\((.*)\),/g, `getPaymentFailedHtml($1, storeName),`);
content = content.replace(/getOrderShippedHtml\((.*)\),/g, `getOrderShippedHtml($1, storeName),`);
content = content.replace(/getOrderDeliveredHtml\((.*)\),/g, `getOrderDeliveredHtml($1, storeName),`);
content = content.replace(/getReturnRequestedHtml\((.*)\),/g, `getReturnRequestedHtml($1, storeName),`);
content = content.replace(/getReturnApprovedHtml\((.*)\),/g, `getReturnApprovedHtml($1, storeName),`);
content = content.replace(/getReturnRejectedHtml\((.*)\),/g, `getReturnRejectedHtml($1, storeName),`);
content = content.replace(/getReturnReceivedHtml\((.*)\),/g, `getReturnReceivedHtml($1, storeName),`);
content = content.replace(/getRefundRequestedHtml\((.*)\),/g, `getRefundRequestedHtml($1, storeName),`);
content = content.replace(/getRefundCompletedHtml\((.*)\),/g, `getRefundCompletedHtml($1, storeName),`);
content = content.replace(/getRefundRejectedHtml\((.*)\),/g, `getRefundRejectedHtml($1, storeName),`);
content = content.replace(/getAdminOrderNotificationHtml\((.*)\),/g, `getAdminOrderNotificationHtml($1, storeName),`);
content = content.replace(/getAdminPaymentFailedHtml\((.*)\),/g, `getAdminPaymentFailedHtml($1, storeName),`);
content = content.replace(/getAdminLowStockHtml\((.*)\),/g, `getAdminLowStockHtml($1, storeName),`);
content = content.replace(/getAdminReturnRequestedHtml\((.*)\),/g, `getAdminReturnRequestedHtml($1, storeName),`);
content = content.replace(/getAdminRefundHtml\((.*)\),/g, `getAdminRefundHtml($1, storeName),`);
content = content.replace(/getStaffAssignmentHtml\((.*)\),/g, `getStaffAssignmentHtml($1, storeName),`);


fs.writeFileSync('src/backend/services/email.service.ts', content);
