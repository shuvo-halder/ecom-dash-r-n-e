export const getBaseTemplate = (title: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
    .header { background-color: #18181b; padding: 24px; text-align: center; color: #ffffff; font-size: 20px; font-weight: 600; }
    .content { padding: 32px; color: #3f3f46; line-height: 1.6; }
    .button-container { margin: 32px 0; text-align: center; }
    .button { background-color: #18181b; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; }
    .footer { padding: 24px; text-align: center; color: #a1a1aa; font-size: 14px; background-color: #fafafa; border-top: 1px solid #f4f4f5; }
    .muted { font-size: 12px; color: #71717a; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      Storefront
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Storefront. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

export const getVerificationEmailHtml = (displayName: string, verificationUrl: string) => getBaseTemplate(
  "Verify Your Email Address",
  `
    <h2>Welcome, ${displayName}!</h2>
    <p>Thank you for registering. Please verify your email address to complete your account setup.</p>
    <div class="button-container">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>This verification link will expire in 24 hours.</p>
    <p class="muted">Security Notice: If you did not request this email, please ignore it. Never share your verification link.</p>
  `
);

export const getEmailChangeHtml = (displayName: string, verificationUrl: string) => getBaseTemplate(
  "Confirm Your New Email Address",
  `
    <h2>Hello, ${displayName},</h2>
    <p>We received a request to change the email address associated with your account.</p>
    <div class="button-container">
      <a href="${verificationUrl}" class="button">Confirm New Email</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>This link will expire in 24 hours.</p>
    <p class="muted">Security Notice: If you did not request this change, please ignore this email and your address will remain unchanged. Do not share this link.</p>
  `
);

export const getPasswordResetHtml = (displayName: string, resetUrl: string) => getBaseTemplate(
  "Reset Your Password",
  `
    <h2>Hello, ${displayName},</h2>
    <p>We received a request to reset the password for your account.</p>
    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link will expire in 1 hour.</p>
    <p class="muted">Security Notice: If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
  `
);


const formatMoney = (amount) => `BDT ${Number(amount || 0).toFixed(2)}`;

export const getOrderDetailsHtml = (order) => `
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Order Summary (#${order.orderNumber})</h3>
      <p style="margin-bottom: 16px;"><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="border-bottom: 1px solid #e4e4e7; text-align: left;">
            <th style="padding: 8px 0;">Item</th>
            <th style="padding: 8px 0; text-align: center;">Qty</th>
            <th style="padding: 8px 0; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map((item) => `
            <tr style="border-bottom: 1px solid #f4f4f5;">
              <td style="padding: 12px 0;">
                <div style="font-weight: 500;">${item.productName}</div>
                ${item.variantSku ? `<div style="font-size: 12px; color: #71717a;">SKU: ${item.variantSku}</div>` : ''}
              </td>
              <td style="padding: 12px 0; text-align: center;">${item.quantity}</td>
              <td style="padding: 12px 0; text-align: right;">${formatMoney(item.price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <table style="width: 100%; margin-bottom: 24px;">
        <tbody>
          <tr>
            <td style="text-align: right; padding: 4px 0; color: #71717a;">Subtotal:</td>
            <td style="text-align: right; padding: 4px 0; width: 120px;">${formatMoney(order.subtotal || order.totalAmount)}</td>
          </tr>
          ${order.shippingFee ? `
          <tr>
            <td style="text-align: right; padding: 4px 0; color: #71717a;">Shipping:</td>
            <td style="text-align: right; padding: 4px 0;">${formatMoney(order.shippingFee)}</td>
          </tr>
          ` : ''}
          ${order.discountAmount ? `
          <tr>
            <td style="text-align: right; padding: 4px 0; color: #71717a;">Discount:</td>
            <td style="text-align: right; padding: 4px 0;">-${formatMoney(order.discountAmount)}</td>
          </tr>
          ` : ''}
          ${order.taxAmount ? `
          <tr>
            <td style="text-align: right; padding: 4px 0; color: #71717a;">Tax:</td>
            <td style="text-align: right; padding: 4px 0;">${formatMoney(order.taxAmount)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; font-size: 16px; border-top: 1px solid #e4e4e7;">Total:</td>
            <td style="text-align: right; padding: 8px 0; font-weight: 600; font-size: 16px; border-top: 1px solid #e4e4e7;">${formatMoney(order.totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-bottom: 24px;">
        <h4 style="margin: 0 0 8px 0; color: #3f3f46;">Payment Method</h4>
        <p style="margin: 0; color: #71717a;">${order.paymentMethod || 'N/A'}</p>
      </div>

      <table style="width: 100%;">
        <tr>
          <td style="vertical-align: top; width: 50%;">
            <h4 style="margin: 0 0 8px 0; color: #3f3f46;">Shipping Address</h4>
            <p style="margin: 0; color: #71717a; white-space: pre-wrap;">${order.shippingAddress || 'N/A'}</p>
          </td>
          ${order.billingAddress ? `
          <td style="vertical-align: top; width: 50%;">
            <h4 style="margin: 0 0 8px 0; color: #3f3f46;">Billing Address</h4>
            <p style="margin: 0; color: #71717a; white-space: pre-wrap;">${order.billingAddress}</p>
          </td>
          ` : ''}
        </tr>
      </table>
    </div>
    <p class="muted" style="margin-top: 32px;">If you have any questions, please reply to this email or contact our support team.</p>
`;

export const getOrderConfirmationHtml = (displayName, order) => getBaseTemplate(
  "Order Confirmation",
  `
    <h2>Hi ${displayName},</h2>
    <p>Thank you for your order! We've received it and are getting it ready for you.</p>
    ${getOrderDetailsHtml(order)}
  `
);

export const getOrderProcessingHtml = (displayName, order) => getBaseTemplate(
  "Your Order is Processing",
  `
    <h2>Hi ${displayName},</h2>
    <p>Good news! We are currently processing your order.</p>
    ${getOrderDetailsHtml(order)}
  `
);

export const getOrderConfirmedHtml = (displayName, order) => getBaseTemplate(
  "Your Order is Confirmed",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your order has been confirmed and will be shipped soon.</p>
    ${getOrderDetailsHtml(order)}
  `
);

export const getOrderCancelledHtml = (displayName, order) => getBaseTemplate(
  "Order Cancelled",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your order has been cancelled. If you have already paid, a refund will be processed according to our policy.</p>
    ${getOrderDetailsHtml(order)}
  `
);


export const getPaymentSuccessHtml = (displayName, payment, order) => getBaseTemplate(
  "Payment Successful",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your payment for Order #${order.orderNumber} was successful.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Payment Details</h3>
      <p style="margin-bottom: 8px;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin-bottom: 8px;"><strong>Amount Paid:</strong> ${payment.currency} ${Number(payment.amount).toFixed(2)}</p>
      <p style="margin-bottom: 8px;"><strong>Payment Method:</strong> ${payment.provider}</p>
      ${payment.transactionReference ? `<p style="margin-bottom: 8px;"><strong>Transaction ID:</strong> ${payment.transactionReference}</p>` : ''}
      <p style="margin-bottom: 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <p style="margin-top: 24px;">Thank you for your purchase!</p>
  `
);

export const getPaymentFailedHtml = (displayName, payment, order) => getBaseTemplate(
  "Payment Failed",
  `
    <h2>Hi ${displayName},</h2>
    <p>Unfortunately, your payment attempt for Order #${order.orderNumber} failed.</p>
    <div style="margin-top: 24px; border: 1px solid #fee2e2; background-color: #fef2f2; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0; color: #b91c1c;">Payment Details</h3>
      <p style="margin-bottom: 8px; color: #991b1b;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin-bottom: 8px; color: #991b1b;"><strong>Amount:</strong> ${payment.currency} ${Number(payment.amount).toFixed(2)}</p>
      <p style="margin-bottom: 0; color: #991b1b;"><strong>Payment Method:</strong> ${payment.provider}</p>
    </div>
    <p style="margin-top: 24px;">Please try again or use a different payment method. If you continue to experience issues, please contact our support team.</p>
  `
);

export const getOrderShippedHtml = (displayName, shipment, order) => getBaseTemplate(
  "Your Order has Shipped",
  `
    <h2>Hi ${displayName},</h2>
    <p>Great news! Your Order #${order.orderNumber} has been shipped.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Shipment Details</h3>
      ${shipment.courier ? `<p style="margin-bottom: 8px;"><strong>Carrier:</strong> ${shipment.courier.name}</p>` : ''}
      ${shipment.trackingNumber ? `<p style="margin-bottom: 8px;"><strong>Tracking Number:</strong> ${shipment.trackingNumber}</p>` : ''}
      <p style="margin-bottom: 0;"><strong>Shipped On:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <div style="margin-top: 24px;">
      <h4 style="margin: 0 0 8px 0; color: #3f3f46;">Shipping Address</h4>
      <p style="margin: 0; color: #71717a; white-space: pre-wrap;">${order.shippingAddress || 'N/A'}</p>
    </div>
  `
);

export const getOrderDeliveredHtml = (displayName, shipment, order) => getBaseTemplate(
  "Your Order has been Delivered",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your Order #${order.orderNumber} has been successfully delivered.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Delivery Details</h3>
      ${shipment.courier ? `<p style="margin-bottom: 8px;"><strong>Carrier:</strong> ${shipment.courier.name}</p>` : ''}
      ${shipment.trackingNumber ? `<p style="margin-bottom: 8px;"><strong>Tracking Number:</strong> ${shipment.trackingNumber}</p>` : ''}
      <p style="margin-bottom: 0;"><strong>Delivered On:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <p style="margin-top: 24px;">We hope you enjoy your purchase! If there are any issues with your order, please contact our support team.</p>
  `
);


export const getReturnRequestedHtml = (displayName, returnReq, order) => getBaseTemplate(
  "Return Requested",
  `
    <h2>Hi ${displayName},</h2>
    <p>We have received your return request for Order #${order.orderNumber}.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Return Details</h3>
      <p style="margin-bottom: 8px;"><strong>Return ID:</strong> ${returnReq.id.split('-')[0]}</p>
      <p style="margin-bottom: 8px;"><strong>Status:</strong> Requested</p>
      <p style="margin-bottom: 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <p style="margin-top: 24px;">Our team will review your request and get back to you shortly.</p>
  `
);

export const getReturnApprovedHtml = (displayName, returnReq, order) => getBaseTemplate(
  "Return Approved",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your return request for Order #${order.orderNumber} has been approved.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Return Details</h3>
      <p style="margin-bottom: 8px;"><strong>Return ID:</strong> ${returnReq.id.split('-')[0]}</p>
      <p style="margin-bottom: 0;"><strong>Status:</strong> Approved</p>
    </div>
    <p style="margin-top: 24px;">Please follow the instructions provided by our support team to send the item(s) back.</p>
  `
);

export const getReturnRejectedHtml = (displayName, returnReq, order) => getBaseTemplate(
  "Return Rejected",
  `
    <h2>Hi ${displayName},</h2>
    <p>We have reviewed your return request for Order #${order.orderNumber}, but unfortunately it has been rejected.</p>
    <div style="margin-top: 24px; border: 1px solid #fee2e2; background-color: #fef2f2; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0; color: #b91c1c;">Return Details</h3>
      <p style="margin-bottom: 8px; color: #991b1b;"><strong>Return ID:</strong> ${returnReq.id.split('-')[0]}</p>
      <p style="margin-bottom: 0; color: #991b1b;"><strong>Status:</strong> Rejected</p>
    </div>
    ${returnReq.adminNotes ? `<p style="margin-top: 16px;"><strong>Reason:</strong> ${returnReq.adminNotes}</p>` : ''}
    <p style="margin-top: 24px;">If you have any questions, please contact our support team.</p>
  `
);

export const getReturnReceivedHtml = (displayName, returnReq, order) => getBaseTemplate(
  "Return Received",
  `
    <h2>Hi ${displayName},</h2>
    <p>We have successfully received the returned item(s) for Order #${order.orderNumber}.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Return Details</h3>
      <p style="margin-bottom: 8px;"><strong>Return ID:</strong> ${returnReq.id.split('-')[0]}</p>
      <p style="margin-bottom: 0;"><strong>Status:</strong> Received</p>
    </div>
    <p style="margin-top: 24px;">We will process your refund or replacement as per our policy shortly.</p>
  `
);

export const getRefundRequestedHtml = (displayName, refund, order) => getBaseTemplate(
  "Refund Requested",
  `
    <h2>Hi ${displayName},</h2>
    <p>We have received your refund request for Order #${order.orderNumber}.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Refund Details</h3>
      <p style="margin-bottom: 8px;"><strong>Amount:</strong> ${refund.currency} ${Number(refund.amount).toFixed(2)}</p>
      <p style="margin-bottom: 8px;"><strong>Status:</strong> Pending Review</p>
      <p style="margin-bottom: 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    </div>
    <p style="margin-top: 24px;">Our team will review your request and process it shortly.</p>
  `
);

export const getRefundCompletedHtml = (displayName, refund, order) => getBaseTemplate(
  "Refund Completed",
  `
    <h2>Hi ${displayName},</h2>
    <p>Your refund for Order #${order.orderNumber} has been successfully processed.</p>
    <div style="margin-top: 24px; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0;">Refund Details</h3>
      <p style="margin-bottom: 8px;"><strong>Amount:</strong> ${refund.currency} ${Number(refund.amount).toFixed(2)}</p>
      <p style="margin-bottom: 0;"><strong>Status:</strong> Completed</p>
    </div>
    <p style="margin-top: 24px;">Please allow a few business days for the amount to reflect in your original payment method.</p>
  `
);

export const getRefundRejectedHtml = (displayName, refund, order) => getBaseTemplate(
  "Refund Rejected",
  `
    <h2>Hi ${displayName},</h2>
    <p>We have reviewed your refund request for Order #${order.orderNumber}, but unfortunately it has been rejected.</p>
    <div style="margin-top: 24px; border: 1px solid #fee2e2; background-color: #fef2f2; border-radius: 6px; padding: 16px;">
      <h3 style="margin-top: 0; color: #b91c1c;">Refund Details</h3>
      <p style="margin-bottom: 8px; color: #991b1b;"><strong>Amount:</strong> ${refund.currency} ${Number(refund.amount).toFixed(2)}</p>
      <p style="margin-bottom: 0; color: #991b1b;"><strong>Status:</strong> Rejected</p>
    </div>
    <p style="margin-top: 24px;">If you have any questions, please contact our support team.</p>
  `
);
