import express from "express";
import {
  createOwnerReview,
  getOwnerReviews,
} from "../controllers/ownerReviewController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

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
