import express from "express";
import {
  getUsers,
  verifyUser,
  deleteUser,
  verifyListing,
  rejectListing,
} from "../controllers/adminController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireRole, requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// All admin routes require admin role
router.use(authenticateToken, requireRole("admin"));

// User management
router.get("/users", requirePermission("view_all_users"), getUsers);
router.patch("/users/:id/verify", requirePermission("verify_user"), verifyUser);
router.delete("/users/:id", requirePermission("delete_user"), deleteUser);

// Listing management
router.patch(
  "/listings/:id/verify",
  requirePermission("verify_listing"),
  verifyListing
);

router.patch(
  "/listings/:id/reject",
  requirePermission("verify_listing"),
  rejectListing
);

export default router;
