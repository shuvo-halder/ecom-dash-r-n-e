const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/order.controller.ts', 'utf-8');

content = content.replace(
  `    res.status(200).json({
      status: "success",
      message: "Order staff updated successfully",
      data: { order: updatedOrder },
    });`,
  `    if (updatedOrder.assignedStaff) {
      const emailService = require("../services/email.service").emailService;
      emailService.sendStaffAssignmentEmail(updatedOrder.assignedStaff, updatedOrder).catch(() => {});
    }

    res.status(200).json({
      status: "success",
      message: "Order staff updated successfully",
      data: { order: updatedOrder },
    });`
);

fs.writeFileSync('src/backend/controllers/order.controller.ts', content);
