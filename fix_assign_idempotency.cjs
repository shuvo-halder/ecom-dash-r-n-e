const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/order.controller.ts', 'utf-8');

content = content.replace(
  'if (!existingOrder) {\n      return next(new AppError("Order not found", 404, "NOT_FOUND"));\n    }',
  'if (!existingOrder) {\n      return next(new AppError("Order not found", 404, "NOT_FOUND"));\n    }\n\n    if (existingOrder.assignedStaffId === (assignedStaffId || null)) {\n      return res.status(200).json({\n        status: "success",\n        message: "Order staff updated successfully",\n        data: { order: existingOrder },\n      });\n    }'
);

fs.writeFileSync('src/backend/controllers/order.controller.ts', content);
