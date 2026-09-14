const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// Inject store branding fetching
const getBrandingStr = `
  private async getStoreName() {
    let setting: any = null;
    try {
      setting = await prisma.brandingSetting.findFirst();
    } catch {
      // Fallback
    }
    if (setting && setting.storeName) {
      return setting.storeName;
    }
    return process.env.STORE_NAME || 'Storefront';
  }
`;

content = content.replace(
  `private async getFromAddress() {`,
  `${getBrandingStr}\n  private async getFromAddress() {`
);

// Add verify function
const verifyStr = `
  public async verify(): Promise<boolean> {
    try {
      const realTransporter = await this.createRealTransporter();
      await realTransporter.verify();
      return true;
    } catch (error: any) {
      this.logError("SMTP Verification Failed", error);
      throw error;
    }
  }
`;

content = content.replace(
  `private async getTransporter() {`,
  `${verifyStr}\n  private async getTransporter() {`
);

fs.writeFileSync('src/backend/services/email.service.ts', content);
