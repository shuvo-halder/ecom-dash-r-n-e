import express from "express";
import {
  getPathaoCities,
  getPathaoZones,
  getPathaoAreas,
  getPathaoStores,
  createPathaoDelivery
} from "../integrations/pathao/pathao.controller";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router = express.Router();

// Require admin authentication and order dispatch permissions
router.use(requireAuth);
router.use(requirePermission("Orders", "read")); // Adjust if write is strictly needed to view, but read is safer for dropdowns

router.get("/cities", getPathaoCities);
router.get("/cities/:cityId/zones", getPathaoZones);
router.get("/zones/:zoneId/areas", getPathaoAreas);
router.get("/stores", getPathaoStores);

// Requires write permission for order dispatch
router.post("/orders/:orderId/ship", requirePermission("Orders", "write"), createPathaoDelivery);

export default router;
