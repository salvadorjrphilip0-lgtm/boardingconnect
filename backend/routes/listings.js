import express from "express";
import {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
} from "../controllers/listingController.js";
import { uploadListingImage } from "../controllers/listingController.js";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";

const router = express.Router();

const upload = multer();

// Public routes
router.get("/", getAllListings);
router.get("/:id", getListingById);

// Owner only routes
router.post(
  "/",
  authenticateToken,
  requirePermission("create_listing"),
  createListing
);

// Upload listing image (multipart/form-data) -> returns public URL
router.post(
  "/upload",
  authenticateToken,
  requirePermission("create_listing"),
  upload.single("image"),
  uploadListingImage
);
router.put(
  "/:id",
  authenticateToken,
  requirePermission("update_listing"),
  updateListing
);
router.delete(
  "/:id",
  authenticateToken,
  requirePermission("delete_listing"),
  deleteListing
);

export default router;
