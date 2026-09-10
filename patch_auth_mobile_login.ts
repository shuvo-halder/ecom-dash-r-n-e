import fs from 'fs';
const file = 'src/backend/controllers/storefront/auth-mobile.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /if \(!customer \|\| !customer\.isActive \|\| customer\.deletedAt\) \{[\s\S]*?return next\(new AppError\("If this number is registered, an OTP will be sent.", 401, "UNAUTHORIZED"\)\);\n    \}/,
  `if (!customer || !customer.isActive || customer.deletedAt) {
      // Return 200 to prevent enumeration
      return res.status(200).json({
        status: "success",
        message: "If this number is registered, an OTP will be sent.",
      });
    }`
);

data = data.replace(
  /if \(!customer\.phoneVerified\) \{[\s\S]*?return next\(new AppError\("If this number is registered and verified, an OTP will be sent.", 401, "UNAUTHORIZED"\)\);\n    \}/,
  `if (!customer.phoneVerified) {
      // Return 200 to prevent enumeration
      return res.status(200).json({
        status: "success",
        message: "If this number is registered, an OTP will be sent.",
      });
    }`
);

fs.writeFileSync(file, data);
