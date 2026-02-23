/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines what each role can do in the system
 */

export const ROLES = {
  RENTER: "renter",
  OWNER: "owner",
  ADMIN: "admin",
};

/**
 * Permissions map: role => array of allowed actions
 */
export const ROLE_PERMISSIONS = {
  renter: [
    // Listings
    "browse_listings",
    "search_listings",
    "view_listing_details",

    // Applications
    "create_application",
    "view_own_applications",
    "cancel_application",

    // Agreements
    "view_own_agreements",
    "confirm_agreement",
    "cancel_agreement",

    // Messaging
    "send_message",
    "view_conversations",
    "view_online_users",

    // Profile
    "view_profile",
    "update_profile",
    "upload_avatar",

    // Reviews
    "create_review",
    "view_reviews",
    "update_review",
    "delete_review",

    // Concerns
    "create_concern",
    "view_own_concerns",
  ],

  owner: [
    // Listings
    "create_listing",
    "update_listing",
    "delete_listing",
    "view_own_listings",

    // Applications
    "view_applications",
    "approve_application",
    "reject_application",

    // Agreements
    "create_agreement",
    "view_own_agreements",
    "confirm_agreement",
    "cancel_agreement",
    "update_rent_status",

    // Messaging
    "send_message",
    "view_conversations",
    "view_online_users",

    // Profile
    "view_profile",
    "update_profile",
    "upload_avatar",

    // Dashboard
    "view_owner_dashboard",
    // Rent management
    "update_rent_status",
  ],

  admin: [
    // User Management
    "verify_user",
    "view_all_users",
    "delete_user",

    // Listing Management
    "verify_listing",
    "view_all_listings",
    "delete_listing",

    // Reviews & Concerns
    "view_all_reviews",
    "view_all_concerns",
    "respond_to_concern",
    "resolve_concern",

    // Reports
    "view_reports",
    "generate_report",
    "export_report",

    // Profile
    "view_profile",
    "update_profile",
    "upload_avatar",

    // Dashboard
    "view_admin_dashboard",
  ],
};

/**
 * Role-based feature flags (for UI visibility)
 */
export const ROLE_FEATURES = {
  renter: {
    canCreateListing: false,
    canVerifyListings: false,
    canApplyToListings: true,
    canViewOwnApplications: true,
    canViewAgreements: true,
    canMessageUsers: true,
    canCreateReview: true,
    canCreateConcern: true,
    canViewOwnConcerns: true,
    canViewReports: false,
  },

  owner: {
    canCreateListing: true,
    canVerifyListings: false,
    canApplyToListings: false,
    canViewApplications: true,
    canApproveApplications: true,
    canManageAgreements: true,
    canUpdateRentStatus: true,
    canMessageUsers: true,
    canViewReports: false,
  },

  admin: {
    canCreateListing: false,
    canVerifyListings: true,
    canVerifyUsers: true,
    canApplyToListings: false,
    canViewAllUsers: true,
    canViewAllListings: true,
    canViewAllReviews: true,
    canViewAllConcerns: true,
    canRespondToConcerns: true,
    canViewReports: true,
    canGenerateReports: true,
  },
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

/**
 * Check if a role has any of the given permissions
 */
export const hasAnyPermission = (role, permissions) => {
  return permissions.some((p) => hasPermission(role, p));
};

/**
 * Check if a role has all of the given permissions
 */
export const hasAllPermissions = (role, permissions) => {
  return permissions.every((p) => hasPermission(role, p));
};

/**
 * Get all features available to a role
 */
export const getRoleFeatures = (role) => {
  return ROLE_FEATURES[role] || {};
};
