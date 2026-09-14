const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email/templates.ts', 'utf-8');

// I see my regex earlier to fix the template signatures failed because I didn't actually run it correctly or it didn't match. 
// TS still says "Expected 2 arguments, but got 3" for templates in email.service.ts
// Let's force replace the arguments.

content = content.replace(/export const getVerificationEmailHtml = \(displayName: string, verificationUrl: string\)/g, "export const getVerificationEmailHtml = (displayName: string, verificationUrl: string, storeName?: string)");
content = content.replace(/export const getEmailChangeHtml = \(displayName: string, verificationUrl: string\)/g, "export const getEmailChangeHtml = (displayName: string, verificationUrl: string, storeName?: string)");
content = content.replace(/export const getPasswordResetHtml = \(displayName: string, resetUrl: string\)/g, "export const getPasswordResetHtml = (displayName: string, resetUrl: string, storeName?: string)");
content = content.replace(/export const getOrderConfirmationHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderConfirmationHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getOrderProcessingHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderProcessingHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getOrderConfirmedHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderConfirmedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getOrderCancelledHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderCancelledHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getPaymentSuccessHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getPaymentSuccessHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getPaymentFailedHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getPaymentFailedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getOrderShippedHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderShippedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getOrderDeliveredHtml = \(displayName: string, order: any, orderUrl: string\)/g, "export const getOrderDeliveredHtml = (displayName: string, order: any, orderUrl: string, storeName?: string)");
content = content.replace(/export const getReturnRequestedHtml = \(displayName: string, returnReq: any, order: any\)/g, "export const getReturnRequestedHtml = (displayName: string, returnReq: any, order: any, storeName?: string)");
content = content.replace(/export const getReturnApprovedHtml = \(displayName: string, returnReq: any, order: any\)/g, "export const getReturnApprovedHtml = (displayName: string, returnReq: any, order: any, storeName?: string)");
content = content.replace(/export const getReturnRejectedHtml = \(displayName: string, returnReq: any, order: any\)/g, "export const getReturnRejectedHtml = (displayName: string, returnReq: any, order: any, storeName?: string)");
content = content.replace(/export const getReturnReceivedHtml = \(displayName: string, returnReq: any, order: any\)/g, "export const getReturnReceivedHtml = (displayName: string, returnReq: any, order: any, storeName?: string)");
content = content.replace(/export const getRefundRequestedHtml = \(displayName: string, refund: any, order: any\)/g, "export const getRefundRequestedHtml = (displayName: string, refund: any, order: any, storeName?: string)");
content = content.replace(/export const getRefundCompletedHtml = \(displayName: string, refund: any, order: any\)/g, "export const getRefundCompletedHtml = (displayName: string, refund: any, order: any, storeName?: string)");
content = content.replace(/export const getRefundRejectedHtml = \(displayName: string, refund: any, order: any\)/g, "export const getRefundRejectedHtml = (displayName: string, refund: any, order: any, storeName?: string)");
content = content.replace(/export const getAdminOrderNotificationHtml = \(order: any, customerInfo: any, adminUrl: string\)/g, "export const getAdminOrderNotificationHtml = (order: any, customerInfo: any, adminUrl: string, storeName?: string)");
content = content.replace(/export const getAdminPaymentFailedHtml = \(order: any, payment: any, customerInfo: any, adminUrl: string\)/g, "export const getAdminPaymentFailedHtml = (order: any, payment: any, customerInfo: any, adminUrl: string, storeName?: string)");
content = content.replace(/export const getAdminLowStockHtml = \(product: any, variant: any, currentStock: number, threshold: number, adminUrl: string\)/g, "export const getAdminLowStockHtml = (product: any, variant: any, currentStock: number, threshold: number, adminUrl: string, storeName?: string)");
content = content.replace(/export const getAdminReturnRequestedHtml = \(returnReq: any, order: any, customerInfo: any, adminUrl: string\)/g, "export const getAdminReturnRequestedHtml = (returnReq: any, order: any, customerInfo: any, adminUrl: string, storeName?: string)");
content = content.replace(/export const getAdminRefundHtml = \(refund: any, order: any, type: 'Requested' \| 'Completed' \| 'Rejected', adminUrl: string\)/g, "export const getAdminRefundHtml = (refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string, storeName?: string)");
content = content.replace(/export const getStaffAssignmentHtml = \(staff: any, order: any, adminUrl: string\)/g, "export const getStaffAssignmentHtml = (staff: any, order: any, adminUrl: string, storeName?: string)");

fs.writeFileSync('src/backend/services/email/templates.ts', content);
