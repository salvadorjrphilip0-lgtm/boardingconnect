import express from "express";
import {
  generateUserActivityReport,
  generateListingVerificationReport,
  generateConcernsSummaryReport,
  getAllReports,
  getReportDetail,
  deleteReport,
} from "../controllers/reportController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

// All report routes require admin role
router.use(authenticateToken, requireRole("admin"));

// Generate reports
router.post("/generate/user-activity", generateUserActivityReport);

router.post(
  "/generate/listing-verification",
  generateListingVerificationReport
);

router.post("/generate/concerns-summary", generateConcernsSummaryReport);

// Get reports
router.get("/", getAllReports);

router.get("/:report_id", getReportDetail);

// Delete report
router.delete("/:report_id", deleteReport);

export default router;
