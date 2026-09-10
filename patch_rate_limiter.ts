import fs from 'fs';
const file = 'src/backend/middlewares/rateLimiter.ts';
let data = fs.readFileSync(file, 'utf8');

const otpLimiter = `
// Dedicated OTP Request limiter (5 requests/minute per IP, NO skipping successes to prevent timing enumeration attacks)
export const otpRequestLimiter = createLimiter({
  max: 5,
  minutes: 1,
  actionName: "OTP_REQUEST_ATTEMPT",
  skipSuccessfulRequests: false
});
`;

if (!data.includes('otpRequestLimiter')) {
  data += otpLimiter;
  fs.writeFileSync(file, data);
}

const routeFile = 'src/backend/routes/storefront/auth.routes.ts';
let routeData = fs.readFileSync(routeFile, 'utf8');

routeData = routeData.replace(
  'resendVerificationLimiter,\n} from "../../middlewares/rateLimiter";',
  'resendVerificationLimiter,\n  otpRequestLimiter,\n} from "../../middlewares/rateLimiter";'
);

routeData = routeData.replace(
  'router.post("/register-mobile", registerLimiter',
  'router.post("/register-mobile", otpRequestLimiter'
);

routeData = routeData.replace(
  'router.post("/login-mobile", loginLimiter',
  'router.post("/login-mobile", otpRequestLimiter'
);

fs.writeFileSync(routeFile, routeData);
