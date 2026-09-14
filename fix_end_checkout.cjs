const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/checkout.service.ts', 'utf-8');

content = content.replace(
  `}
      for (const alert of lowStockAlerts) {
        emailService.sendAdminLowStockEmail(alert.product, alert.variant, alert.currentStock, alert.threshold).catch(() => {});
      }
    } catch (err) {`,
  `      for (const alert of lowStockAlerts) {
        emailService.sendAdminLowStockEmail(alert.product, alert.variant, alert.currentStock, alert.threshold).catch(() => {});
      }
    } catch (err) {`
);

fs.writeFileSync('src/backend/services/storefront/checkout.service.ts', content);
