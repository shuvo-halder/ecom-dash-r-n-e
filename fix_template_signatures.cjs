const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email/templates.ts', 'utf-8');

// I notice some templates didn't get storeName correctly appended. The earlier regex might have missed them if they didn't have optional arguments initially?
// Wait, TS says "Expected 2 arguments, but got 3." for something in email.service.ts
// Let's check which lines in email.service.ts:
// src/backend/services/email.service.ts(228,58): error TS2554: Expected 2 arguments, but got 3. -> getVerificationEmailHtml(displayName, verificationUrl, storeName) 
// So getVerificationEmailHtml only expects 2! 

// Ah! Let's just redefine ALL the template function signatures to manually ensure they accept an optional storeName.

// In templates.ts:
content = content.replace(/export const getVerificationEmailHtml = \(displayName: string, verificationUrl: string\) =>/g, "export const getVerificationEmailHtml = (displayName: string, verificationUrl: string, storeName?: string) =>");
content = content.replace(/export const getEmailChangeHtml = \(displayName: string, verificationUrl: string\) =>/g, "export const getEmailChangeHtml = (displayName: string, verificationUrl: string, storeName?: string) =>");
content = content.replace(/export const getPasswordResetHtml = \(displayName: string, resetUrl: string\) =>/g, "export const getPasswordResetHtml = (displayName: string, resetUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderConfirmationHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderConfirmationHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderProcessingHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderProcessingHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderConfirmedHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderConfirmedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderCancelledHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderCancelledHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getPaymentSuccessHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getPaymentSuccessHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getPaymentFailedHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getPaymentFailedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderShippedHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderShippedHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getOrderDeliveredHtml = \(displayName: string, order: any, orderUrl: string\) =>/g, "export const getOrderDeliveredHtml = (displayName: string, order: any, orderUrl: string, storeName?: string) =>");
content = content.replace(/export const getReturnRequestedHtml = \(displayName: string, returnReq: any, order: any\) =>/g, "export const getReturnRequestedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) =>");
content = content.replace(/export const getReturnApprovedHtml = \(displayName: string, returnReq: any, order: any\) =>/g, "export const getReturnApprovedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) =>");
content = content.replace(/export const getReturnRejectedHtml = \(displayName: string, returnReq: any, order: any\) =>/g, "export const getReturnRejectedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) =>");
content = content.replace(/export const getReturnReceivedHtml = \(displayName: string, returnReq: any, order: any\) =>/g, "export const getReturnReceivedHtml = (displayName: string, returnReq: any, order: any, storeName?: string) =>");
content = content.replace(/export const getRefundRequestedHtml = \(displayName: string, refund: any, order: any\) =>/g, "export const getRefundRequestedHtml = (displayName: string, refund: any, order: any, storeName?: string) =>");
content = content.replace(/export const getRefundCompletedHtml = \(displayName: string, refund: any, order: any\) =>/g, "export const getRefundCompletedHtml = (displayName: string, refund: any, order: any, storeName?: string) =>");
content = content.replace(/export const getRefundRejectedHtml = \(displayName: string, refund: any, order: any\) =>/g, "export const getRefundRejectedHtml = (displayName: string, refund: any, order: any, storeName?: string) =>");
content = content.replace(/export const getAdminOrderNotificationHtml = \(order: any, customerInfo: any, adminUrl: string\) =>/g, "export const getAdminOrderNotificationHtml = (order: any, customerInfo: any, adminUrl: string, storeName?: string) =>");
content = content.replace(/export const getAdminPaymentFailedHtml = \(order: any, payment: any, customerInfo: any, adminUrl: string\) =>/g, "export const getAdminPaymentFailedHtml = (order: any, payment: any, customerInfo: any, adminUrl: string, storeName?: string) =>");
content = content.replace(/export const getAdminLowStockHtml = \(product: any, variant: any, currentStock: number, threshold: number, adminUrl: string\) =>/g, "export const getAdminLowStockHtml = (product: any, variant: any, currentStock: number, threshold: number, adminUrl: string, storeName?: string) =>");
content = content.replace(/export const getAdminReturnRequestedHtml = \(returnReq: any, order: any, customerInfo: any, adminUrl: string\) =>/g, "export const getAdminReturnRequestedHtml = (returnReq: any, order: any, customerInfo: any, adminUrl: string, storeName?: string) =>");
content = content.replace(/export const getAdminRefundHtml = \(refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string\) =>/g, "export const getAdminRefundHtml = (refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected', adminUrl: string, storeName?: string) =>");
content = content.replace(/export const getStaffAssignmentHtml = \(staff: any, order: any, adminUrl: string\) =>/g, "export const getStaffAssignmentHtml = (staff: any, order: any, adminUrl: string, storeName?: string) =>");

fs.writeFileSync('src/backend/services/email/templates.ts', content);
