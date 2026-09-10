const fs = require('fs');
const file = '/app/applet/src/backend/services/storefront/setting.service.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    const [branding, seo, analytics, store, shipping, tax] = await Promise.all([
      prisma.brandingSetting.findFirst(),
      prisma.sEOSetting.findFirst(),
      prisma.analyticsSetting.findFirst(),
      prisma.storeSetting.findFirst(),
      prisma.shippingSetting.findFirst(),
      prisma.taxSetting.findFirst()
    ]);`;

const replacement = `    const [branding, seo, analytics, store, shipping, tax] = await Promise.all([
      prisma.brandingSetting.findFirst().catch(e => { console.error("Branding DB drift", e); return null; }),
      prisma.sEOSetting.findFirst().catch(e => { console.error("SEO DB drift", e); return null; }),
      prisma.analyticsSetting.findFirst().catch(e => { console.error("Analytics DB drift", e); return null; }),
      prisma.storeSetting.findFirst().catch(e => { console.error("Store DB drift", e); return null; }),
      prisma.shippingSetting.findFirst().catch(e => { console.error("Shipping DB drift", e); return null; }),
      prisma.taxSetting.findFirst().catch(e => { console.error("Tax DB drift", e); return null; })
    ]);`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Patched setting.service.ts');
} else {
  console.log('Target not found in setting.service.ts');
}
