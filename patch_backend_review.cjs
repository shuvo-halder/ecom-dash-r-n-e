const fs = require('fs');

let service = fs.readFileSync('src/backend/services/review.service.ts', 'utf8');

const targetMethod = `  static async listReviews(query: any) {`;
const insertMethod = `  static async getStats() {
    const [total, pending, approved, rejected, hidden, verified] = await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { status: 'PENDING' } }),
      prisma.review.count({ where: { status: 'APPROVED' } }),
      prisma.review.count({ where: { status: 'REJECTED' } }),
      prisma.review.count({ where: { status: 'HIDDEN' } }),
      prisma.review.count({ where: { isVerifiedPurchase: true } }),
    ]);
    return { total, pending, approved, rejected, hidden, verified };
  }

  static async listReviews(query: any) {`;

service = service.replace(targetMethod, insertMethod);
fs.writeFileSync('src/backend/services/review.service.ts', service);

let controller = fs.readFileSync('src/backend/controllers/review.controller.ts', 'utf8');
const controllerMethod = `export const listReviews = async (req: Request, res: Response, next: NextFunction) => {`;
const newControllerMethod = `export const getReviewStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AdminReviewService.getStats();
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const listReviews = async (req: Request, res: Response, next: NextFunction) => {`;

controller = controller.replace(controllerMethod, newControllerMethod);
fs.writeFileSync('src/backend/controllers/review.controller.ts', controller);

let routes = fs.readFileSync('src/backend/routes/review.routes.ts', 'utf8');
routes = routes.replace('listReviews,', 'listReviews,\n  getReviewStats,');
routes = routes.replace('router.get("/", requirePermission("Products", "read"), listReviews);', 'router.get("/stats", requirePermission("Products", "read"), getReviewStats);\nrouter.get("/", requirePermission("Products", "read"), listReviews);');

fs.writeFileSync('src/backend/routes/review.routes.ts', routes);
