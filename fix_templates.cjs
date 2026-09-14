const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email/templates.ts', 'utf-8');

// Replace the signature and hardcoded store name
content = content.replace(
  `export const getBaseTemplate = (title: string, content: string) => \`<!DOCTYPE html><html><head>`,
  `export const getBaseTemplate = (title: string, content: string, storeName: string = "Storefront") => \`<!DOCTYPE html><html><head>`
);

content = content.replace(
  `    <div class="header">
      Storefront
    </div>`,
  `    <div class="header">
      \${storeName}
    </div>`
);

content = content.replace(
  `    <div class="footer">
      &copy; \${new Date().getFullYear()} Storefront. All rights reserved.
    </div>`,
  `    <div class="footer">
      &copy; \${new Date().getFullYear()} \${storeName}. All rights reserved.
    </div>`
);

// We need to inject storeName down from EmailService to templates
// Let's modify all template functions to take storeName optionally at the end

content = content.replace(
  `export const getVerificationEmailHtml = (displayName: string, verificationUrl: string) => getBaseTemplate(`,
  `export const getVerificationEmailHtml = (displayName: string, verificationUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getEmailChangeHtml = (displayName: string, verificationUrl: string) => getBaseTemplate(`,
  `export const getEmailChangeHtml = (displayName: string, verificationUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getPasswordResetHtml = (displayName: string, resetUrl: string) => getBaseTemplate(`,
  `export const getPasswordResetHtml = (displayName: string, resetUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderConfirmationHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderConfirmationHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderProcessingHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderProcessingHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderConfirmedHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderConfirmedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderCancelledHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderCancelledHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getPaymentSuccessHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getPaymentSuccessHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getPaymentFailedHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getPaymentFailedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderShippedHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderShippedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getOrderDeliveredHtml = (displayName: string, order: any, orderUrl: string) => getBaseTemplate(`,
  `export const getOrderDeliveredHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getReturnRequestedHtml = (displayName: string, returnReq: any, order: any) => getBaseTemplate(`,
  `export const getReturnRequestedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getReturnApprovedHtml = (displayName: string, returnReq: any, order: any) => getBaseTemplate(`,
  `export const getReturnApprovedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getReturnRejectedHtml = (displayName: string, returnReq: any, order: any) => getBaseTemplate(`,
  `export const getReturnRejectedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getReturnReceivedHtml = (displayName: string, returnReq: any, order: any) => getBaseTemplate(`,
  `export const getReturnReceivedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getRefundRequestedHtml = (displayName: string, refund: any, order: any) => getBaseTemplate(`,
  `export const getRefundRequestedHtml = (displayName: string, refund: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getRefundCompletedHtml = (displayName: string, refund: any, order: any) => getBaseTemplate(`,
  `export const getRefundCompletedHtml = (displayName: string, refund: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getRefundRejectedHtml = (displayName: string, refund: any, order: any) => getBaseTemplate(`,
  `export const getRefundRejectedHtml = (displayName: string, refund: any, order: any, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getAdminOrderNotificationHtml = (order: any, customerInfo: any, adminUrl: string) => getBaseTemplate(`,
  `export const getAdminOrderNotificationHtml = (order: any, customerInfo: any, adminUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getAdminPaymentFailedHtml = (order: any, payment: any, customerInfo: any, adminUrl: string) => getBaseTemplate(`,
  `export const getAdminPaymentFailedHtml = (order: any, payment: any, customerInfo: any, adminUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getAdminLowStockHtml = (product: any, variant: any, currentStock: number, threshold: number, adminUrl: string) => getBaseTemplate(`,
  `export const getAdminLowStockHtml = (product: any, variant: any, currentStock: number, threshold: number, adminUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getAdminReturnRequestedHtml = (returnReq: any, order: any, customerInfo: any, adminUrl: string) => getBaseTemplate(`,
  `export const getAdminReturnRequestedHtml = (returnReq: any, order: any, customerInfo: any, adminUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getAdminRefundHtml = (refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string) => getBaseTemplate(`,
  `export const getAdminRefundHtml = (refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string, storeName?: string) => getBaseTemplate(`
);
content = content.replace(
  `export const getStaffAssignmentHtml = (staff: any, order: any, adminUrl: string) => getBaseTemplate(`,
  `export const getStaffAssignmentHtml = (staff: any, order: any, adminUrl: string, storeName?: string) => getBaseTemplate(`
);

// We need to pass the storeName down, we'll do this in a single replace pass
content = content.replace(/,(\n|\s)*`(\n|\s)*<h2/g, ', content: `\n    <h2'); // Avoid breaking syntax
content = content.replace(/,(\n|\s)*`(\n|\s)*<h3/g, ', content: `\n    <h3');

// Re-write the passing of storeName down to getBaseTemplate for all templates
const lines = content.split('\n');
let fixedContent = '';
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(') => getBaseTemplate(')) {
    // Modify the second line which is typically the title
    fixedContent += lines[i] + '\n';
    let titleLine = lines[++i];
    // Add storeName at the end
    fixedContent += titleLine + '\n';
  } else if (lines[i] === ');' && fixedContent.includes(') => getBaseTemplate(')) {
    // This is the closing of getBaseTemplate, inject storeName
    fixedContent = fixedContent.slice(0, -1) + ',\n  storeName\n);\n';
  } else {
    fixedContent += lines[i] + '\n';
  }
}

// Just do a safer manual replace with regex
content = content.replace(
  /(export const [a-zA-Z]+ = \(.*?, storeName\?: string\) => getBaseTemplate\([\s\S]*?)(\n\);)/gm,
  `$1,\n  storeName$2`
);


fs.writeFileSync('src/backend/services/email/templates.ts', content);
