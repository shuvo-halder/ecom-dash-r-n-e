import fs from 'fs';
const file = 'src/backend/controllers/storefront/auth-mobile.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  '// Return a generic response to prevent phone enumeration\n      return next(new AppError("If this number is registered, an OTP will be sent.", 401, "UNAUTHORIZED"));',
  '// Return 200 to prevent enumeration\n      return res.status(200).json({\n        status: "success",\n        message: "If this number is registered, an OTP will be sent.",\n      });'
);

data = data.replace(
  'return next(new AppError("If this number is registered and verified, an OTP will be sent.", 401, "UNAUTHORIZED"));',
  '// Return 200 to prevent enumeration\n       return res.status(200).json({\n         status: "success",\n         message: "If this number is registered, an OTP will be sent.",\n       });'
);

fs.writeFileSync(file, data);
