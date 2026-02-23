import express from "express";
import {
  createReview,
  getListingReviews,
  updateReview,
  deleteReview,
  getAllReviews,
} from "../controllers/reviewController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";

const router = express.Router();

// Admin routes - must come first
router.get(
  "/admin/all",
  authenticateToken,
  requireRole("admin"),
  getAllReviews
);

// Public routes
router.get("/:listing_id", getListingReviews);

// Protected routes - requires authentication
router.post(
  "/",
  authenticateToken,
  requirePermission("create_review"),
  createReview
);

router.put(
  "/:review_id",
  authenticateToken,
  requirePermission("create_review"),
  updateReview
);

router.delete(
  "/:review_id",
  authenticateToken,
  requirePermission("create_review"),
  deleteReview
);

export default router;
