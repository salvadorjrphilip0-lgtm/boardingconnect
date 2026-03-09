import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import {
  submitWebsiteReview,
  getMyWebsiteReview,
  getWebsiteReviewSummary,
} from "../controllers/websiteReviewController.js";

const router = express.Router();

router.get("/me", authenticateToken, getMyWebsiteReview);
router.post(
  "/",
  authenticateToken,
  requireRole(["renter", "owner"]),
  submitWebsiteReview,
);
router.get(
  "/admin/summary",
  authenticateToken,
  requireRole("admin"),
  getWebsiteReviewSummary,
);

export default router;
