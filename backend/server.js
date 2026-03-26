import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth.js";
import listingRoutes from "./routes/listings.js";
import applicationRoutes from "./routes/applications.js";
import agreementRoutes from "./routes/agreements.js";
import adminRoutes from "./routes/admin.js";
import reviewRoutes from "./routes/reviews.js";
import ownerReviewRoutes from "./routes/ownerReviews.js";
import concernRoutes from "./routes/concerns.js";
import reportRoutes from "./routes/reports.js";
import statsRoutes from "./routes/stats.js";
import websiteReviewRoutes from "./routes/websiteReviews.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (
  process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const vercelPreviewOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser or same-origin requests (no Origin header)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        vercelPreviewOriginPattern.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/agreements", agreementRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/owner-reviews", ownerReviewRoutes);
app.use("/api/concerns", concernRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/website-reviews", websiteReviewRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Boarding Connect API is running" });
});

// Root route (useful for Vercel deployment sanity checks)
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Boarding Connect API",
    health: "/api/health",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;

// Start server only for local development/non-serverless environments
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}
