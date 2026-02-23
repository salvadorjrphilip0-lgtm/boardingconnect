import express from "express";
import {
  createApplication,
  getUserApplications,
  updateApplicationStatus,
  getRentersByListing,
} from "../controllers/applicationController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission, requireAnyPermission } from "../middleware/rbac.js";

const router = express.Router();

// Renter creates application
router.post(
  "/",
  authenticateToken,
  requirePermission("create_application"),
  createApplication,
);

// Get user's own applications
router.get("/user", authenticateToken, getUserApplications);

// Get renters for a specific listing (owner only)
router.get(
  "/listing/:listingId/renters",
  authenticateToken,
  getRentersByListing,
);

// Owner approves/rejects or renter cancels
router.patch(
  "/:id",
  authenticateToken,
  requireAnyPermission([
    "approve_application",
    "reject_application",
    "cancel_application",
  ]),
  updateApplicationStatus,
);

export default router;
