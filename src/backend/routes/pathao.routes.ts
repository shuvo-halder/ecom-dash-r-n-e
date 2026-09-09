import express from "express";
import {
  getPathaoCities,
  getPathaoZones,
  getPathaoAreas,
  getPathaoStores,
  createPathaoDelivery,
  refreshPathaoShipment,
  cancelPathaoShipment,
  getPathaoShipment,
  handlePathaoWebhook,
  syncPathaoShipmentsManually,
} from "../integrations/pathao/pathao.controller";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router = express.Router();

// -------------------------------------------------------------
// PUBLIC WEBHOOK ENDPOINT (Signature authenticated, no staff JWT)
// -------------------------------------------------------------
router.post("/webhook", handlePathaoWebhook);

// -------------------------------------------------------------
// PROTECTED ADMIN ENDPOINTS
// -------------------------------------------------------------
// Require admin authentication and order dispatch permissions
router.use(requireAuth);
router.use(requirePermission("Orders", "read")); // Adjust if write is strictly needed to view, but read is safer for dropdowns

router.get("/cities", getPathaoCities);
router.get("/cities/:cityId/zones", getPathaoZones);
router.get("/zones/:zoneId/areas", getPathaoAreas);
router.get("/stores", getPathaoStores);

// Requires write permission for order dispatch
router.post("/orders/:orderId/ship", requirePermission("Orders", "write"), createPathaoDelivery);

// Shipment management & sync endpoints
router.get("/shipments/:shipmentId", getPathaoShipment);
router.post("/shipments/:shipmentId/refresh", requirePermission("Orders", "write"), refreshPathaoShipment);
router.post("/shipments/:shipmentId/cancel", requirePermission("Orders", "write"), cancelPathaoShipment);
router.post("/sync", requirePermission("Orders", "write"), syncPathaoShipmentsManually);

export default router;
