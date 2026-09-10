const fs = require('fs');
const file = '/app/applet/src/backend/middlewares/customerAuth.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `  } catch (error: any) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    console.warn(\`[SECURITY] Invalid customer JWT Token attempt from IP: \${ip}, error: \${error.message}\`);
    
    try {
      await prisma.activityLog.create({
        data: {
          userId: null,
          action: "INVALID_CUSTOMER_TOKEN",
          entityType: "Security",
          entityId: null,
          ipAddress: ip,
          details: JSON.stringify({
            reason: error.message || "JWT verification failed",
            tokenFragment: req.headers.authorization ? req.headers.authorization.substring(0, 15) + "..." : null,
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (logErr) {
      console.error("Failed to log invalid customer token to activity log:", logErr);
    }

    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }`;

const replacement = `  } catch (error: any) {
    const isExpired = error.message === "jwt expired" || error.name === "TokenExpiredError";
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    
    if (!isExpired) {
      console.warn(\`[SECURITY] Invalid customer JWT Token attempt from IP: \${ip}, error: \${error.message}\`);
      try {
        await prisma.activityLog.create({
          data: {
            userId: null,
            action: "INVALID_CUSTOMER_TOKEN",
            entityType: "Security",
            entityId: null,
            ipAddress: ip,
            details: JSON.stringify({
              reason: error.message || "JWT verification failed",
              tokenFragment: req.headers.authorization ? req.headers.authorization.substring(0, 15) + "..." : null,
              timestamp: new Date().toISOString()
            })
          }
        });
      } catch (logErr) {
        console.error("Failed to log invalid customer token to activity log:", logErr);
      }
    }

    return next(new AppError(isExpired ? "Token expired" : "Invalid token", 401, "UNAUTHORIZED"));
  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(file, code);
  console.log('Patched customerAuth.ts');
} else {
  console.log('Target not found in customerAuth.ts');
}
