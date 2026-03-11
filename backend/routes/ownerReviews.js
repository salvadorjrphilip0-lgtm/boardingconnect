import express from "express";
import {
  createOwnerReview,
  getOwnerReviews,
  getAllOwnerReviews,
} from "../controllers/ownerReviewController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";

const router = express.Router();

// Admin route
router.get(
  "/admin/all",
  authenticateToken,
  requireRole("admin"),
  getAllOwnerReviews,
);

// Public route
router.get("/:owner_id", getOwnerReviews);

// Protected route
router.post(
  "/",
  authenticateToken,
  requirePermission("create_review"),
  createOwnerReview,
);

export default router;
