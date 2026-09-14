const fs = require('fs');
const content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

const newMethods = `
  async getAdminRecipients(): Promise<string[]> {
    const recipients: string[] = [];
    try {
      const storeSetting = await prisma.storeSetting.findFirst();
      if (storeSetting && storeSetting.supportEmail) {
        recipients.push(storeSetting.supportEmail);
      }
      
      if (recipients.length === 0) {
        const superAdmins = await prisma.user.findMany({
          where: { role: { name: 'SUPER_ADMIN' }, isActive: true, deletedAt: null }
        });
        recipients.push(...superAdmins.map(u => u.email));
      }
    } catch (error) {
      logger.error("[EmailService] Failed to resolve admin recipients", error);
    }
    
    return Array.from(new Set(recipients)).filter(Boolean);
  }

  async sendAdminOrderNotificationEmail(order: any) {
    const recipients = await this.getAdminRecipients();
    if (!recipients.length) return;
    
    let customerInfo = { name: "Guest", email: "N/A" };
    if (order.customer) {
      customerInfo = { name: (order.customer.firstName + " " + (order.customer.lastName || "")).trim(), email: order.customer.email };
    } else if (order.customerEmail) {
      customerInfo.email = order.customerEmail;
    }
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: recipients.join(','),
      subject: \`New Order: #\${order.orderNumber}\`,
      html: getAdminOrderNotificationHtml(order, customerInfo, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Admin order notification failed for order \${order.orderNumber}\`, error);
    }
  }

  async sendAdminPaymentFailedEmail(payment: any, order: any) {
    const recipients = await this.getAdminRecipients();
    if (!recipients.length) return;
    
    let customerInfo = { name: "Guest", email: "N/A" };
    if (order.customer) {
      customerInfo = { name: (order.customer.firstName + " " + (order.customer.lastName || "")).trim(), email: order.customer.email };
    } else if (order.customerEmail) {
      customerInfo.email = order.customerEmail;
    }
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: recipients.join(','),
      subject: \`Payment Failed: #\${order.orderNumber}\`,
      html: getAdminPaymentFailedHtml(order, payment, customerInfo, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Admin payment failed email delivery failed for order \${order.orderNumber}\`, error);
    }
  }

  async sendAdminLowStockEmail(product: any, variant: any, currentStock: number, threshold: number) {
    const recipients = await this.getAdminRecipients();
    if (!recipients.length) return;
    
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: recipients.join(','),
      subject: \`Low Stock Alert: \${product.name}\`,
      html: getAdminLowStockHtml(product, variant, currentStock, threshold, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Admin low stock email delivery failed for product \${product.id}\`, error);
    }
  }

  async sendAdminReturnRequestedEmail(returnReq: any, order: any) {
    const recipients = await this.getAdminRecipients();
    if (!recipients.length) return;
    
    let customerInfo = { name: "Guest", email: "N/A" };
    if (order.customer) {
      customerInfo = { name: (order.customer.firstName + " " + (order.customer.lastName || "")).trim(), email: order.customer.email };
    } else if (order.customerEmail) {
      customerInfo.email = order.customerEmail;
    }
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: recipients.join(','),
      subject: \`Return Requested: #\${order.orderNumber}\`,
      html: getAdminReturnRequestedHtml(returnReq, order, customerInfo, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Admin return requested email delivery failed for order \${order.orderNumber}\`, error);
    }
  }

  async sendAdminRefundEmail(refund: any, order: any, type: 'Requested' | 'Completed' | 'Rejected') {
    const recipients = await this.getAdminRecipients();
    if (!recipients.length) return;
    
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: recipients.join(','),
      subject: \`Refund \${type}: #\${order.orderNumber}\`,
      html: getAdminRefundHtml(refund, order, type, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Admin refund \${type} email delivery failed for order \${order.orderNumber}\`, error);
    }
  }

  async sendStaffAssignmentEmail(staff: any, order: any) {
    if (!staff || !staff.email) return;
    
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";

    const mailOptions = {
      to: staff.email,
      subject: \`Order Assigned: #\${order.orderNumber}\`,
      html: getStaffAssignmentHtml(staff, order, adminUrl),
    };

    try {
      await this.send(mailOptions);
    } catch (error: any) {
      this.logError(\`Staff assignment email delivery failed for order \${order.orderNumber}\`, error);
    }
  }
`;

// Insert before the last closing brace of the class
const classEndIndex = content.lastIndexOf('}');
const newContent = content.substring(0, classEndIndex) + newMethods + content.substring(classEndIndex);

fs.writeFileSync('src/backend/services/email.service.ts', newContent);
console.log('Appended methods');
