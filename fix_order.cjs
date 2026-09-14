const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/order.controller.ts', 'utf-8');

// Remove from updateOrderStatus
const toRemove = `
    if (existingOrder.assignedStaffId === (assignedStaffId || null)) {
      return res.status(200).json({
        status: "success",
        message: "Order staff updated successfully",
        data: { order: existingOrder },
      });
    }
`;

content = content.replace(toRemove, '');

// Add to assignOrderStaff
const targetStr = `
    if (!existingOrder) {
      return next(new AppError("Order not found", 404, "NOT_FOUND"));
    }
`;

const addStr = `
    if (!existingOrder) {
      return next(new AppError("Order not found", 404, "NOT_FOUND"));
    }

    if (existingOrder.assignedStaffId === (assignedStaffId || null)) {
      return res.status(200).json({
        status: "success",
        message: "Order staff updated successfully",
        data: { order: existingOrder },
      });
    }
`;

content = content.replace(targetStr, addStr);

fs.writeFileSync('src/backend/controllers/order.controller.ts', content);
