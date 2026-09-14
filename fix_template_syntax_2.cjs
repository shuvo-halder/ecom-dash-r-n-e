const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email/templates.ts', 'utf-8');

// I can see the signature got duplicated on line 432:
// export const getAdminRefundHtml = ... =>|export const getAdminRefundHtml = ... =>| ...

content = content.replace(/export const getAdminRefundHtml = \(refund: any, order: any, type: 'Requested' \| 'Completed' \| 'Rejected', adminUrl: string, storeName\?: string\) =>\|export const getAdminRefundHtml = \(refund: any, order: any, type: 'Requested' \| 'Completed' \| 'Rejected', adminUrl: string, storeName\?: string\) =>\| 'Rejected', adminUrl: string, storeName\?: string\) => getBaseTemplate/g, "export const getAdminRefundHtml = (refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string, storeName?: string) => getBaseTemplate");

fs.writeFileSync('src/backend/services/email/templates.ts', content);
