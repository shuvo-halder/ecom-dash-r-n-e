const fs = require('fs');
const file = '/app/applet/src/backend/controllers/storefront/auth-mobile.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `    if (!customer || !customer.isActive || customer.deletedAt) {
      // Return 200 to prevent enumeration
      return res.status(200).json({
        status: "success",
        message: "If this number is registered, an OTP will be sent.",
      });
    }

    if (!customer.phoneVerified) {
      // Return 200 to prevent enumeration
      return res.status(200).json({
        status: "success",
        message: "If this number is registered, an OTP will be sent.",
      });
    }`;

const replacement1 = `    if (!customer || !customer.isActive || customer.deletedAt) {
      return next(new AppError("Account not found or inactive", 401, "UNAUTHORIZED"));
    }

    if (!customer.phoneVerified) {
      return next(new AppError("Phone number not verified", 401, "UNAUTHORIZED"));
    }`;

if (code.includes(target1)) {
  code = code.replace(target1, replacement1);
  fs.writeFileSync(file, code);
  console.log('Patched loginMobile in auth-mobile.controller.ts');
} else {
  console.log('Failed to patch loginMobile');
}
