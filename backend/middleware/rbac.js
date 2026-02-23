/**
 * Role-Based Access Control Middleware
 */

const ROLE_PERMISSIONS = {
  renter: [
    "browse_listings",
    "search_listings",
    "view_listing_details",
    "create_application",
    "view_own_applications",
    "cancel_application",
    "view_own_agreements",
    "confirm_agreement",
    "cancel_agreement",
    "send_message",
    "view_conversations",
    "view_online_users",
    "view_profile",
    "update_profile",
    "upload_avatar",
    "create_review",
    "view_reviews",
    "update_review",
    "delete_review",
    "create_concern",
    "view_own_concerns",
  ],

  owner: [
    "create_listing",
    "update_listing",
    "delete_listing",
    "view_own_listings",
    "view_applications",
    "approve_application",
    "reject_application",
    "create_agreement",
    "view_own_agreements",
    "confirm_agreement",
    "cancel_agreement",
    "update_rent_status",
    "send_message",
    "view_conversations",
    "view_online_users",
    "view_profile",
    "update_profile",
    "upload_avatar",
    "view_owner_dashboard",
  ],

  admin: [
    "verify_user",
    "view_all_users",
    "delete_user",
    "verify_listing",
    "view_all_listings",
    "delete_listing",
    "view_all_reviews",
    "view_all_concerns",
    "respond_to_concern",
    "resolve_concern",
    "view_reports",
    "generate_report",
    "export_report",
    "view_profile",
    "update_profile",
    "upload_avatar",
    "update_rent_status",
    "view_admin_dashboard",
  ],
};

/**
 * Middleware: Check if user has a specific permission
 * Usage: router.get('/endpoint', requirePermission('permission_name'), controller)
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole] || [];

    if (!permissions.includes(permission)) {
      return res.status(403).json({
        message: `Permission denied. Required: ${permission}`,
      });
    }

    next();
  };
};

/**
 * Middleware: Check if user has any of the given permissions
 */
export const requireAnyPermission = (permissionsArray) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    const hasAny = permissionsArray.some((p) => permissions.includes(p));

    if (!hasAny) {
      return res.status(403).json({
        message: `Permission denied. Required one of: ${permissionsArray.join(
          ", ",
        )}`,
      });
    }

    next();
  };
};

/**
 * Middleware: Check if user has all of the given permissions
 */
export const requireAllPermissions = (permissionsArray) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRole = req.user.role;
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    const hasAll = permissionsArray.every((p) => permissions.includes(p));

    if (!hasAll) {
      return res.status(403).json({
        message: `Permission denied. Required all of: ${permissionsArray.join(
          ", ",
        )}`,
      });
    }

    next();
  };
};

/**
 * Middleware: Restrict to specific roles
 * Usage: router.get('/endpoint', requireRole('admin'), controller)
 *        router.get('/endpoint', requireRole(['admin', 'owner']), controller)
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rolesArray = Array.isArray(roles) ? roles : [roles];

    if (!rolesArray.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required roles: ${rolesArray.join(", ")}`,
      });
    }

    next();
  };
};

/**
 * Helper function to check if a user has a permission (can be used in controllers)
 */
export const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};
