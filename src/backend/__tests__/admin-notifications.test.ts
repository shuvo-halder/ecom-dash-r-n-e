import test from "node:test";
import assert from "node:assert";
import { StorefrontCheckoutService } from "../services/storefront/checkout.service";
import { PaymentSecurityService } from "../services/storefront/paymentSecurity.service";
import { assignOrderStaff } from "../controllers/order.controller";
import { emailService } from "../services/email.service";
import { prisma } from "../config/db";

test("EMAIL-3A: Admin/Staff Email Notification Verification", async (suite) => {
  let sendOrderConfirmationEmailCalled = 0;
  let sendAdminOrderNotificationEmailCalled = 0;
  let sendAdminLowStockEmailCalled = 0;
  let sendAdminPaymentFailedEmailCalled = 0;
  let sendStaffAssignmentEmailCalled = 0;
  
  const origSendOrderConfirmationEmail = emailService.sendOrderConfirmationEmail;
  const origSendAdminOrderNotificationEmail = emailService.sendAdminOrderNotificationEmail;
  const origSendAdminLowStockEmail = emailService.sendAdminLowStockEmail;
  const origSendAdminPaymentFailedEmail = emailService.sendAdminPaymentFailedEmail;
  const origSendStaffAssignmentEmail = emailService.sendStaffAssignmentEmail;

  emailService.sendOrderConfirmationEmail = async () => { sendOrderConfirmationEmailCalled++; };
  emailService.sendAdminOrderNotificationEmail = async () => { sendAdminOrderNotificationEmailCalled++; };
  emailService.sendAdminLowStockEmail = async () => { sendAdminLowStockEmailCalled++; };
  emailService.sendAdminPaymentFailedEmail = async () => { sendAdminPaymentFailedEmailCalled++; };
  emailService.sendStaffAssignmentEmail = async () => { sendStaffAssignmentEmailCalled++; };

  const origTransaction = prisma.$transaction;
  const origCartFindFirst = prisma.cart.findFirst;
  const origOrderUpdate = prisma.order.update;
  const origPaymentFindUnique = prisma.payment.findUnique;
  const origOrderFindUnique = prisma.order.findUnique;
  const origOrderFindFirst = prisma.order.findFirst;
  const origUserFindFirst = prisma.user.findFirst;
  
  suite.after(() => {
    emailService.sendOrderConfirmationEmail = origSendOrderConfirmationEmail;
    emailService.sendAdminOrderNotificationEmail = origSendAdminOrderNotificationEmail;
    emailService.sendAdminLowStockEmail = origSendAdminLowStockEmail;
    emailService.sendAdminPaymentFailedEmail = origSendAdminPaymentFailedEmail;
    emailService.sendStaffAssignmentEmail = origSendStaffAssignmentEmail;

    prisma.$transaction = origTransaction;
    prisma.cart.findFirst = origCartFindFirst;
    prisma.order.update = origOrderUpdate;
    prisma.payment.findUnique = origPaymentFindUnique;
    prisma.order.findUnique = origOrderFindUnique;
    prisma.order.findFirst = origOrderFindFirst;
    prisma.user.findFirst = origUserFindFirst;
  });

  await suite.test("1. Low-Stock Transaction Safety - Rollback Prevents Email", async () => {
    sendAdminLowStockEmailCalled = 0;
    let txCalled = false;
    (prisma.$transaction as any) = async (cb: any) => {
      txCalled = true;
      throw new Error("Simulated Rollback");
    };

    try {
      await StorefrontCheckoutService.completeCheckout({ customerId: "c1" }, "COD");
    } catch (e) {
      assert.strictEqual(e.message, "Simulated Rollback");
    }

    assert.strictEqual(txCalled, true, "Transaction must have been called");
    assert.strictEqual(sendAdminLowStockEmailCalled, 0, "No low-stock email should be sent on rollback");
  });

  await suite.test("2. Payment Failure Duplicate Protection", async () => {
    sendAdminPaymentFailedEmailCalled = 0;
    
    (prisma.payment.findUnique as any) = async () => {
      return { id: "p1", status: "FAILED", orderId: "o1", amount: 100, currency: "USD" };
    };

    let webhookLogUpdateCalled = 0;
    (prisma.$transaction as any) = async (cb: any) => {
       return await cb({
         $executeRaw: async () => {}, 
         paymentWebhookLog: {
           create: async () => ({ id: "log1" }),
           update: async () => { webhookLogUpdateCalled++; },
           findFirst: async () => null,
         },
         payment: {
           findUnique: async () => ({ id: "p1", status: "FAILED", orderId: "o1", amount: 100, currency: "USD" }),
           update: async () => ({})
         },
         paymentTransaction: {
           create: async () => ({})
         }
       });
    };

    const verification = {
      verified: true,
      isSuccess: false,
      paymentId: "p1",
      providerTransactionId: "txn123",
      amount: "100"
    };

    const res = await PaymentSecurityService.processVerifiedPayment("STRIPE", verification as any);

    assert.strictEqual(res.status, "ALREADY_PROCESSED");
    assert.strictEqual(sendAdminPaymentFailedEmailCalled, 0, "Should not send duplicate email for already FAILED payment");
  });

  await suite.test("3. Staff Assignment Duplicate Protection", async () => {
    sendStaffAssignmentEmailCalled = 0;

    (prisma.order.findFirst as any) = async () => {
      return { id: "o1", assignedStaffId: "staff1" };
    };
    (prisma.user.findFirst as any) = async () => {
      return { id: "staff1", firstName: "Staff", lastName: "1" };
    };
    (prisma.order.update as any) = async () => {
      return { id: "o1", assignedStaffId: "staff1" };
    };

    const req = {
      params: { id: "o1" },
      body: { assignedStaffId: "staff1" },
      user: { id: "admin1", email: "admin@test.com" }
    };
    
    let jsonCalled = false;
    const res = {
      status: () => res,
      json: (data: any) => { jsonCalled = true; return res; }
    };
    res.status = () => res;

    await assignOrderStaff(req as any, res as any, () => {});

    assert.strictEqual(jsonCalled, true);
    assert.strictEqual(sendStaffAssignmentEmailCalled, 0, "Should not send assignment email for duplicate assignment");
  });
  
  await suite.test("4. Email Failure Isolation", async () => {
    sendStaffAssignmentEmailCalled = 0;
    
    (prisma.order.findFirst as any) = async () => {
      return { id: "o1", assignedStaffId: null }; // Current is unassigned
    };
    (prisma.user.findFirst as any) = async () => {
      return { id: "staff2", firstName: "Staff", lastName: "2" };
    };
    (prisma.order.update as any) = async () => {
      return { id: "o1", assignedStaffId: "staff2", assignedStaff: { email: "staff@test.com" } };
    };

    emailService.sendStaffAssignmentEmail = async () => { throw new Error("SMTP Error"); };

    const req = {
      params: { id: "o1" },
      body: { assignedStaffId: "staff2" },
      user: { id: "admin1" }
    };
    
    let jsonCalled = false;
    const res = {
      status: () => res,
      json: (data: any) => { jsonCalled = true; return res; }
    };
    res.status = () => res;

    await assignOrderStaff(req as any, res as any, () => {});

    assert.strictEqual(jsonCalled, true, "Execution should complete despite email failure");
  });
});
