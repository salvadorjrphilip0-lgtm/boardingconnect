import express from "express";
import {
  sendMessage,
  getConversations,
  getMessages,
  getOnlineUsers,
} from "../controllers/messageController.js";
import { authenticateToken } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

const router = express.Router();

// All messaging requires send_message permission
router.post(
  "/",
  authenticateToken,
  requirePermission("send_message"),
  sendMessage
);
router.get(
  "/conversations",
  authenticateToken,
  requirePermission("view_conversations"),
  getConversations
);
router.get(
  "/online-users",
  authenticateToken,
  requirePermission("view_online_users"),
  getOnlineUsers
);
router.get(
  "/:conversationId",
  authenticateToken,
  requirePermission("view_conversations"),
  getMessages
);

export default router;
