import express from "express";
import { CourierController } from "../controllers/courier.controller";
import { requireAuth, requirePermission } from "../middlewares/auth";

const router = express.Router();

router.use(requireAuth);

// Provider listing and details (Settings:read permission)
router.get(
  "/providers",
  requirePermission("Settings", "read"),
  CourierController.listProviders
);

router.get(
  "/providers/:id",
  requirePermission("Settings", "read"),
  CourierController.getProvider
);

// Provider updates, testing, and default selection (Settings:write permission)
router.put(
  "/providers/:id",
  requirePermission("Settings", "write"),
  CourierController.updateProviderConfig
);

router.post(
  "/providers/:id/test",
  requirePermission("Settings", "write"),
  CourierController.testProvider
);

router.post(
  "/providers/active",
  requirePermission("Settings", "write"),
  CourierController.setActiveProvider
);

export default router;
