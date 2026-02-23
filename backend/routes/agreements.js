import express from "express";
import {
  getUserAgreements,
  createAgreement,
  confirmAgreement,
  cancelAgreement,
  updateRentStatus,
  getAgreementsByListing,
  getAllAgreements,
  getRentSummary,
  renterConfirmAgreement,
  ownerConfirmAgreement,
  getAgreementActivityLog,
} from "../controllers/agreementController.js";
import {
  confirmApplication,
  cancelApplication,
} from "../controllers/applicationController.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requirePermission,
  requireAnyPermission,
  requireRole,
} from "../middleware/rbac.js";

const router = express.Router();

// Get user's own agreements
router.get("/user", authenticateToken, getUserAgreements);

// Renter requests an agreement for a listing
router.post("/", authenticateToken, createAgreement);

// Owner or admin update rent status, due/end dates
router.patch(
  "/:id/rent",
  authenticateToken,
  requirePermission("update_rent_status"),
  updateRentStatus,
);

// Get agreements for a specific listing (owner can view own listing, admin all)
router.get("/listing/:listingId", authenticateToken, getAgreementsByListing);

// Admin route to fetch every agreement
router.get("/all", authenticateToken, requireRole("admin"), getAllAgreements);

// Admin rent summary report
router.get(
  "/summary",
  authenticateToken,
  requirePermission("view_reports"),
  getRentSummary,
);

// Confirm or cancel agreement (renter/owner)
router.patch(
  "/:id/confirm",
  authenticateToken,
  requireAnyPermission(["confirm_agreement"]),
  confirmAgreement,
);
router.patch(
  "/:id/cancel",
  authenticateToken,
  requireAnyPermission(["cancel_agreement"]),
  cancelAgreement,
);

// Renter confirm agreement (sets renter_confirmed_at)
router.patch(
  "/:id/renter-confirm",
  authenticateToken,
  requirePermission("confirm_agreement"),
  renterConfirmAgreement,
);

// Owner confirm agreement (sets owner_confirmed_at)
router.patch(
  "/:id/owner-confirm",
  authenticateToken,
  requirePermission("confirm_agreement"),
  ownerConfirmAgreement,
);

// Get activity log for agreement
router.get("/:id/activity-log", authenticateToken, getAgreementActivityLog);

// Renter confirm application (creates agreement as pending_owner)
router.post(
  "/../applications/:id/confirm",
  authenticateToken,
  requirePermission("confirm_agreement"),
  confirmApplication,
);

// Renter cancel application
router.post(
  "/../applications/:id/cancel",
  authenticateToken,
  requirePermission("confirm_agreement"),
  cancelApplication,
);

export default router;
