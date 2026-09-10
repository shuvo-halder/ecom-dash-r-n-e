const fs = require('fs');
const file = '/app/applet/src/backend/utils/customerJwt.ts';
let code = fs.readFileSync(file, 'utf8');

const badCatch = `  } catch (error) {
    throw new AppError("Invalid or expired customer token", 401, "UNAUTHORIZED");
  }`;

const goodCatch = `  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new AppError("jwt expired", 401, "UNAUTHORIZED");
    }
    throw new AppError("Invalid or expired customer token", 401, "UNAUTHORIZED");
  }`;

code = code.split(badCatch).join(goodCatch);
fs.writeFileSync(file, code);
console.log('Patched customerJwt.ts');
