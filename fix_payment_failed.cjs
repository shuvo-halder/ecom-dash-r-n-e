const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/paymentSecurity.service.ts', 'utf-8');

// The failure paths return an object `{ status: "FAILED" | "REJECTED", ... }`. 
// We can just add the email sending logic before the return.

content = content.replace(
  `        await tx.paymentWebhookLog.update({
          where: { id: webhookLog.id },
          data: { processed: true, processedAt: new Date() },
        });

        return {
          status: "FAILED",
          message: "Payment verification reported failure status",
          payment: failedPayment,
        };`,
  `        await tx.paymentWebhookLog.update({
          where: { id: webhookLog.id },
          data: { processed: true, processedAt: new Date() },
        });

        const fullOrder = await tx.order.findUnique({ where: { id: payment.orderId }, include: { customer: true } });
        if (fullOrder) {
          const emailService = require("../email.service").emailService;
          const customerInfo = fullOrder.customer ? { email: fullOrder.customer.email, firstName: fullOrder.customer.firstName, lastName: fullOrder.customer.lastName } : { email: fullOrder.customerEmail || "Guest", firstName: "Guest" };
          emailService.sendPaymentFailedEmail(customerInfo, failedPayment, fullOrder).catch(() => {});
          emailService.sendAdminPaymentFailedEmail(failedPayment, fullOrder).catch(() => {});
        }

        return {
          status: "FAILED",
          message: "Payment verification reported failure status",
          payment: failedPayment,
        };`
);

content = content.replace(
  `          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });

          throw new AppError(`,
  `          const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
          });
          
          const fullOrder = await tx.order.findUnique({ where: { id: payment.orderId }, include: { customer: true } });
          if (fullOrder) {
            const emailService = require("../email.service").emailService;
            const customerInfo = fullOrder.customer ? { email: fullOrder.customer.email, firstName: fullOrder.customer.firstName, lastName: fullOrder.customer.lastName } : { email: fullOrder.customerEmail || "Guest", firstName: "Guest" };
            emailService.sendPaymentFailedEmail(customerInfo, updatedPayment, fullOrder).catch(() => {});
            emailService.sendAdminPaymentFailedEmail(updatedPayment, fullOrder).catch(() => {});
          }

          throw new AppError(`
);

fs.writeFileSync('src/backend/services/storefront/paymentSecurity.service.ts', content);
