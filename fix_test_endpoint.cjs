const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/setting.controller.ts', 'utf-8');

// Add testSMTP function
const testSMTPStr = `
export const testSMTP = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { emailService } = require("../services/email.service");
    
    // Check if SMTP is enabled
    const { SettingService } = require("../services/setting.service");
    const smtpSettings = await SettingService.getSMTP();
    
    if (!smtpSettings || !smtpSettings.enabled) {
      return res.status(400).json({
        status: "error",
        message: "SMTP is currently disabled. Please enable it before testing."
      });
    }

    try {
      // 1. Verify connection
      await emailService.verify();
      
      // 2. Send test email to the authenticated admin
      const recipient = req.user?.email;
      if (!recipient) {
         return res.status(400).json({
           status: "error",
           message: "Admin email address not found in authenticated session."
         });
      }
      
      const { getBaseTemplate } = require("../services/email/templates");
      const storeName = await emailService.getStoreName();
      
      const mailOptions = {
        to: recipient,
        subject: "SMTP Test Verification",
        html: getBaseTemplate(
          "SMTP Test Email", 
          "<p>If you are receiving this email, your SMTP configuration is successfully verified and working.</p>",
          storeName
        )
      };
      
      await emailService.send(mailOptions);
      
      return res.status(200).json({ 
        status: "success", 
        message: "SMTP connection verified and test email successfully sent to your admin email address." 
      });

    } catch (smtpError: any) {
      return res.status(400).json({
        status: "error",
        message: "SMTP connection failed. Please verify the SMTP host, port, security mode, username, and password."
      });
    }

  } catch (error) { next(error); }
};
`;

content += testSMTPStr;
fs.writeFileSync('src/backend/controllers/setting.controller.ts', content);

// Add to routes
let routesContent = fs.readFileSync('src/backend/routes/setting.routes.ts', 'utf-8');
routesContent = routesContent.replace(
  `import { \n  getGeneral`,
  `import { \n  testSMTP,\n  getGeneral`
);
routesContent = routesContent.replace(
  `router.put("/smtp", requirePermission("Settings", "write"), validateBody(updateSMTPSettingsSchema), updateSMTP);`,
  `router.put("/smtp", requirePermission("Settings", "write"), validateBody(updateSMTPSettingsSchema), updateSMTP);\nrouter.post("/smtp/test", requirePermission("Settings", "write"), testSMTP);`
);

fs.writeFileSync('src/backend/routes/setting.routes.ts', routesContent);
