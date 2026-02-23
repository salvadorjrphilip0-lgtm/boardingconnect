import express from "express";
import { body } from "express-validator";
import multer from "multer";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  uploadAvatar,
  uploadAvatarMultipart,
} from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Validation rules
const registerValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("fullName").notEmpty().withMessage("Full name is required"),
  body("phone").notEmpty().withMessage("Phone number is required"),
  // Allow 'admin' if you want admins to self-register. Be careful: self-registering admins
  // are a security risk in production. Consider restricting this in production deployments.
  body("role").isIn(["renter", "owner", "admin"]).withMessage("Invalid role"),
  // optional fields for ID verification (required later for renter/owner in controller)
  // ID fields should be optional but should be skipped when empty strings are provided
  body("idType")
    .optional({ checkFalsy: true })
    .isIn(["national_id", "passport", "drivers_license", "student_id"]) // canonical id types
    .withMessage("Invalid id type"),
  body("idNumber")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("Invalid id number"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Routes
// Allow registration to include an ID image (field name: 'idImage')
router.post(
  "/register",
  upload.single("idImage"),
  registerValidation,
  register
);
router.post("/login", loginValidation, login);
router.put("/me", authenticateToken, updateProfile);
router.post("/me/avatar", authenticateToken, uploadAvatar);
router.post(
  "/me/avatar/upload",
  authenticateToken,
  upload.single("file"),
  uploadAvatarMultipart
);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticateToken, getCurrentUser);

export default router;
