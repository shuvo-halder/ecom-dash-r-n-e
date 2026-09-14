const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/checkout.service.ts', 'utf-8');

content = content.replace(
  'const order = await prisma.$transaction(async (tx) => {',
  'const lowStockAlerts: any[] = [];\n    const order = await prisma.$transaction(async (tx) => {'
);

content = content.replace(
  /if \(useFallback\) \{\s+const updated = await tx\.inventory\.updateMany\(\{\s+where: \{\s+id: product\.inventory\.id,\s+quantityAvailable: \{ gte: item\.quantity \+ product\.inventory\.quantityReserved \}\s+\},\s+data: \{\s+quantityAvailable: \{ decrement: item\.quantity \},\s+\},\s+\}\);\s+if \(updated\.count === 0\) \{\s+throw new AppError\(`Insufficient stock for "\$\{product\.name\}" during checkout\.`, 409, "INSUFFICIENT_STOCK"\);\s+\}\s+itemWarehouseMap\.set\(item\.id, product\.inventory\.warehouseId \|\| null\);\s+\} else \{/,
  `if (useFallback) {
              const previousAvailable = product.inventory.quantityAvailable;
              const threshold = product.inventory.lowStockThreshold;
              const updated = await tx.inventory.updateMany({
                where: {
                  id: product.inventory.id,
                  quantityAvailable: { gte: item.quantity + product.inventory.quantityReserved }
                },
                data: {
                  quantityAvailable: { decrement: item.quantity },
                },
              });
              if (updated.count === 0) {
                throw new AppError(\`Insufficient stock for "\${product.name}" during checkout.\`, 409, "INSUFFICIENT_STOCK");
              }
              if (previousAvailable > threshold && (previousAvailable - item.quantity) <= threshold) {
                lowStockAlerts.push({ product, variant, currentStock: previousAvailable - item.quantity, threshold });
              }
              itemWarehouseMap.set(item.id, product.inventory.warehouseId || null);
            } else {`
);

content = content.replace(
  /if \(targetInventory\) \{\s+const updated = await tx\.inventory\.updateMany\(\{\s+where: \{\s+id: targetInventory\.id,\s+quantityAvailable: \{ gte: item\.quantity \+ targetInventory\.quantityReserved \}\s+\},\s+data: \{\s+quantityAvailable: \{ decrement: item\.quantity \},\s+\},\s+\}\);\s+if \(updated\.count === 0\) \{\s+throw new AppError\(`Insufficient stock for "\$\{product\.name\}" during checkout\.`, 409, "INSUFFICIENT_STOCK"\);\s+\}\s+itemWarehouseMap\.set\(item\.id, targetInventory\.warehouseId \|\| null\);\s+\}/,
  `if (targetInventory) {
                const previousAvailable = targetInventory.quantityAvailable;
                const threshold = targetInventory.lowStockThreshold;
                const updated = await tx.inventory.updateMany({
                  where: {
                    id: targetInventory.id,
                    quantityAvailable: { gte: item.quantity + targetInventory.quantityReserved }
                  },
                  data: {
                    quantityAvailable: { decrement: item.quantity },
                  },
                });
                if (updated.count === 0) {
                  throw new AppError(\`Insufficient stock for "\${product.name}" during checkout.\`, 409, "INSUFFICIENT_STOCK");
                }
                if (previousAvailable > threshold && (previousAvailable - item.quantity) <= threshold) {
                  lowStockAlerts.push({ product, variant, currentStock: previousAvailable - item.quantity, threshold });
                }
                itemWarehouseMap.set(item.id, targetInventory.warehouseId || null);
              }`
);

content = content.replace(
  /const updated = await tx\.inventory\.updateMany\(\{\s+where: \{\s+id: product\.inventory\.id,\s+quantityAvailable: \{ gte: item\.quantity \+ product\.inventory\.quantityReserved \}\s+\},\s+data: \{\s+quantityAvailable: \{ decrement: item\.quantity \},\s+\},\s+\}\);\s+if \(updated\.count === 0\) \{\s+throw new AppError\(`Insufficient stock for "\$\{product\.name\}" during checkout\.`, 409, "INSUFFICIENT_STOCK"\);\s+\}\s+itemWarehouseMap\.set\(item\.id, product\.inventory\.warehouseId \|\| null\);\s+\}/,
  `const previousAvailable = product.inventory.quantityAvailable;
            const threshold = product.inventory.lowStockThreshold;
            const updated = await tx.inventory.updateMany({
              where: {
                id: product.inventory.id,
                quantityAvailable: { gte: item.quantity + product.inventory.quantityReserved }
              },
              data: {
                quantityAvailable: { decrement: item.quantity },
              },
            });
            if (updated.count === 0) {
              throw new AppError(\`Insufficient stock for "\${product.name}" during checkout.\`, 409, "INSUFFICIENT_STOCK");
            }
            if (previousAvailable > threshold && (previousAvailable - item.quantity) <= threshold) {
              lowStockAlerts.push({ product, variant: null, currentStock: previousAvailable - item.quantity, threshold });
            }
            itemWarehouseMap.set(item.id, product.inventory.warehouseId || null);
          }`
);

content = content.replace(
  /if \(fullOrder\) \{\s+emailService\.sendOrderConfirmationEmail\(customer, fullOrder\)\.catch\(\(err\) => \{\s+console\.error\(`\[Email Service\] Failed to send order confirmation to \$\{customer\.email\}`\);\s+\}\);\s+\}/,
  `if (fullOrder) {
            emailService.sendOrderConfirmationEmail(customer, fullOrder).catch((err) => {
              console.error(\`[Email Service] Failed to send order confirmation to \${customer.email}\`);
            });
            emailService.sendAdminOrderNotificationEmail(fullOrder).catch(() => {});
          }`
);

content = content.replace(
  /if \(fullOrder\) \{\s+const guestCustomer = \{ email: order\.customerEmail, firstName: "Guest" \};\s+emailService\.sendOrderConfirmationEmail\(guestCustomer, fullOrder\)\.catch\(\(err\) => \{\s+console\.error\(`\[Email Service\] Failed to send order confirmation to guest email \$\{guestCustomer\.email\}`\);\s+\}\);\s+\}/,
  `if (fullOrder) {
              const guestCustomer = { email: order.customerEmail, firstName: "Guest" };
              emailService.sendOrderConfirmationEmail(guestCustomer, fullOrder).catch((err) => {
                console.error(\`[Email Service] Failed to send order confirmation to guest email \${guestCustomer.email}\`);
              });
              emailService.sendAdminOrderNotificationEmail(fullOrder).catch(() => {});
            }`
);

const lastCatchIndex = content.lastIndexOf('} catch (err) {');
if (lastCatchIndex !== -1) {
  content = content.substring(0, lastCatchIndex) + 
`}
      for (const alert of lowStockAlerts) {
        emailService.sendAdminLowStockEmail(alert.product, alert.variant, alert.currentStock, alert.threshold).catch(() => {});
      }
    } catch (err) {`
  + content.substring(lastCatchIndex + 15);
}

fs.writeFileSync('src/backend/services/storefront/checkout.service.ts', content);
