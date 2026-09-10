import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { validateParamsUUID, validateQuery, validateBody } from "../middlewares/validation";
import { AppError } from "../utils/AppError";
import { PermissionService } from "../services/permission.service";
import { AuditService } from "../services/audit.service";
import {
  listArchived,
  restoreEntity,
  checkHardDeleteSafety,
  hardDeleteEntity,
} from "../controllers/archive.controller";
import {
  archiveListQuerySchema,
  hardDeleteBodySchema,
  SUPPORTED_ARCHIVE_ENTITIES,
  SupportedArchiveEntityType,
} from "../validators/archive.validator";

export const ENTITY_PERMISSION_MODULES: Record<SupportedArchiveEntityType, string[]> = {
  products: ["Products"],
  variants: ["Products"],
  "product-images": ["Products"],
  categories: ["Categories"],
  brands: ["Brands"],
  orders: ["Orders"],
  payments: ["Payments", "Orders"],
  refunds: ["Orders", "Refunds"],
  returns: ["Orders", "Returns"],
  shipments: ["Orders", "Shipments"],
  coupons: ["Coupons"],
  promotions: ["Promotions"],
  "marketing-campaigns": ["Marketing"],
  banners: ["Banners"],
  popups: ["Popups"],
  pages: ["CMS", "Pages"],
  "landing-pages": ["LandingPages", "CMS"],
  "blog-posts": ["Blog"],
  faqs: ["FAQ"],
  reviews: ["Products", "Reviews"],
  users: ["Users"],
  roles: ["Roles"],
};

/**
 * Validates that the route parameter :entityType belongs to the supported whitelist.
 */
export const validateArchiveEntityType = (req: Request, res: Response, next: NextFunction) => {
  const entityType = req.params.entityType as SupportedArchiveEntityType;
  if (!SUPPORTED_ARCHIVE_ENTITIES.includes(entityType)) {
    return next(
      new AppError(
        `Unsupported archive entity type: ${req.params.entityType}`,
        400,
        "INVALID_ENTITY_TYPE"
      )
    );
  }
  next();
};

/**
 * RBAC middleware checking permissions for the requested archive entity module.
 */
export const requireArchivePermission = (action: "read" | "write") => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return next(new AppError("Unauthorized: Authentication required", 401, "UNAUTHORIZED"));
      }

      // Super Admins bypass permission checks
      if (
        PermissionService.isSuperAdmin(user) ||
        user.roleName === "Super Admin" ||
        (user as any).role?.name === "Super Admin"
      ) {
        return next();
      }

      const entityType = req.params.entityType as SupportedArchiveEntityType;
      const modules = ENTITY_PERMISSION_MODULES[entityType] || [];

      const hasAccess = modules.some((moduleName) =>
        PermissionService.hasPermission(user, moduleName, action)
      );

      if (!hasAccess) {
        const requiredStr = `Archive.${entityType}.${action} (${modules.join(" or ")})`;
        await AuditService.logAccessDenied(user.id, requiredStr, req);
        return next(
          new AppError(
            `You do not have permission to ${action} archived ${entityType}`,
            403,
            "FORBIDDEN"
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * RBAC middleware checking permissions for hard deletion.
 * Enforces highest administrative privilege: Super Admin.
 * Logs unauthorized access attempts using AuditService.logAccessDenied.
 */
export const requireHardDeletePermission = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return next(new AppError("Unauthorized: Authentication required", 401, "UNAUTHORIZED"));
      }

      const isSuperAdmin =
        PermissionService.isSuperAdmin(user) ||
        user.roleName === "SuperAdmin" ||
        user.roleName === "Super Admin" ||
        (user as any).role?.name === "SuperAdmin" ||
        (user as any).role?.name === "Super Admin";

      if (!isSuperAdmin) {
        const entityType = req.params.entityType as SupportedArchiveEntityType;
        const requiredStr = `Archive.${entityType}.hard_delete (SuperAdmin)`;
        await AuditService.logAccessDenied(user.id, requiredStr, req);
        return next(
          new AppError(
            `Hard delete requires SuperAdmin administrative privileges. Access denied.`,
            403,
            "HARD_DELETE_PERMISSION_DENIED"
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const router = Router();

// Authentication required for all archive routes
router.use(requireAuth);

// GET /api/v1/archive/:entityType
router.get(
  "/:entityType",
  validateArchiveEntityType,
  validateQuery(archiveListQuerySchema),
  requireArchivePermission("read"),
  listArchived
);

// POST /api/v1/archive/:entityType/:id/restore
router.post(
  "/:entityType/:id/restore",
  validateArchiveEntityType,
  validateParamsUUID(["id"]),
  requireArchivePermission("write"),
  restoreEntity
);

// GET /api/v1/archive/:entityType/:id/hard-delete-check
router.get(
  "/:entityType/:id/hard-delete-check",
  validateArchiveEntityType,
  validateParamsUUID(["id"]),
  requireHardDeletePermission(),
  checkHardDeleteSafety
);

// DELETE /api/v1/archive/:entityType/:id/hard-delete
router.delete(
  "/:entityType/:id/hard-delete",
  validateArchiveEntityType,
  validateParamsUUID(["id"]),
  validateBody(hardDeleteBodySchema),
  requireHardDeletePermission(),
  hardDeleteEntity
);

export default router;
