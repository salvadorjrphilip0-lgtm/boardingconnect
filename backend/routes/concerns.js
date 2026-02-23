import express from "express";
import {
  createConcern,
  getRenterConcerns,
  getAllConcerns,
  respondToConcern,
  resolveConcern,
  getConcernDetail,
} from "../controllers/concernController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";

const router = express.Router();

// Admin routes - must come first to avoid conflicts
router.get(
  "/admin/all",
  authenticateToken,
  requireRole("admin"),
  getAllConcerns
);

router.patch(
  "/:concern_id/respond",
  authenticateToken,
  requireRole("admin"),
  respondToConcern
);

router.patch(
  "/:concern_id/resolve",
  authenticateToken,
  requireRole("admin"),
  resolveConcern
);

// Protected routes - requires authentication
router.post(
  "/",
  authenticateToken,
  requirePermission("create_concern"),
  createConcern
);

router.get("/", authenticateToken, getRenterConcerns);

router.get("/:concern_id", authenticateToken, getConcernDetail);

export default router;
