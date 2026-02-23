import express from "express";
import { getStats } from "../controllers/statsController.js";

const router = express.Router();

// Public stats endpoint used by frontend homepage
router.get("/", getStats);

export default router;
