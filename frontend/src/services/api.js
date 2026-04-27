import axios from "axios";
import { API_URL } from "../utils/config";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Auth Services
export const authService = {
  register: async (userData) => {
    // Support FormData (multipart) or plain JSON
    if (userData instanceof FormData) {
      const response = await api.post("/auth/register", userData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    }

    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },
  // Get profile from server
  getProfile: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put("/auth/me", profileData);
    return response.data;
  },

  uploadAvatar: async ({ imageBase64, fileName }) => {
    const response = await api.post("/auth/me/avatar", {
      imageBase64,
      fileName,
    });
    return response.data;
  },

  uploadAvatarMultipart: async (formData) => {
    const response = await api.post("/auth/me/avatar/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  // New password reset flow
  verifyAccountForPasswordReset: async (email, phone) => {
    const response = await api.post("/auth/verify-account-for-reset", {
      email,
      phone,
    });
    return response.data;
  },

  requestPasswordReset: async (userId, newPassword) => {
    const response = await api.post("/auth/request-password-reset", {
      userId,
      newPassword,
    });
    return response.data;
  },

  // Admin password reset management
  getPendingPasswordResets: async () => {
    const response = await api.get("/auth/admin/password-reset-requests");
    return response.data;
  },

  approvePasswordReset: async (resetRequestId) => {
    const response = await api.put(
      "/auth/admin/password-reset-requests/approve",
      { resetRequestId },
    );
    return response.data;
  },

  rejectPasswordReset: async (resetRequestId, rejectionReason) => {
    const response = await api.put(
      "/auth/admin/password-reset-requests/reject",
      { resetRequestId, rejectionReason },
    );
    return response.data;
  },
};

// Listing Services
export const listingService = {
  getAll: async (filters = {}) => {
    const response = await api.get("/listings", { params: filters });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  create: async (listingData) => {
    const response = await api.post("/listings", listingData);
    return response.data;
  },

  update: async (id, listingData) => {
    const response = await api.put(`/listings/${id}`, listingData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/listings/${id}`);
    return response.data;
  },

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api.post("/listings/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

// Application Services
export const application_Service = {
  create: async (applicationData) => {
    const response = await api.post("/applications", applicationData);
    return response.data;
  },

  getByUser: async () => {
    const response = await api.get("/applications/user");
    return response.data;
  },

  getByListing: async (listingId) => {
    const response = await api.get(`/applications/listing/${listingId}`);
    return response.data;
  },

  getRentersByListing: async (listingId) => {
    const response = await api.get(
      `/applications/listing/${listingId}/renters`,
    );
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(`/applications/${id}`, { status });
    return response.data;
  },

  confirm: async (id) => {
    const response = await api.post(`/applications/${id}/confirm`);
    return response.data;
  },

  cancel: async (id, reason) => {
    const response = await api.post(`/applications/${id}/cancel`, { reason });
    return response.data;
  },
};

// Agreement Services
export const agreementService = {
  create: async (agreementData) => {
    const response = await api.post("/agreements", agreementData);
    return response.data;
  },

  getByUser: async () => {
    const response = await api.get("/agreements/user");
    return response.data;
  },

  confirm: async (id) => {
    const response = await api.patch(`/agreements/${id}/confirm`);
    return response.data;
  },

  cancel: async (id, reason) => {
    const response = await api.patch(`/agreements/${id}/cancel`, { reason });
    return response.data;
  },

  // owner/admin rent status update
  // statusData may include rent_status, due_date, end_date, start_date
  updateStatus: async (id, statusData) => {
    const response = await api.patch(`/agreements/${id}/rent`, statusData);
    return response.data;
  },

  // fetch agreements for a listing
  getByListing: async (listingId) => {
    const response = await api.get(`/agreements/listing/${listingId}`);
    return response.data;
  },

  // admin helpers
  getAll: async () => {
    const response = await api.get("/agreements/all");
    return response.data;
  },

  getSummary: async () => {
    const response = await api.get("/agreements/summary");
    return response.data;
  },

  // Renter confirm agreement
  confirmByRenter: async (id) => {
    const response = await api.patch(`/agreements/${id}/renter-confirm`);
    return response.data;
  },

  // Owner confirm agreement
  confirmByOwner: async (id) => {
    const response = await api.patch(`/agreements/${id}/owner-confirm`);
    return response.data;
  },

  // Get activity log for agreement
  getActivityLog: async (id) => {
    const response = await api.get(`/agreements/${id}/activity-log`);
    return response.data;
  },
};

// Application service
export const applicationService = {
  apply: async (listing_id, message) => {
    const response = await api.post("/applications", {
      listing_id,
      message,
    });
    return response.data;
  },

  getUserApplications: async () => {
    const response = await api.get("/applications/user");
    return response.data;
  },

  getListingApplications: async (listing_id) => {
    const response = await api.get(`/applications/listing/${listing_id}`);
    return response.data;
  },

  getRentersByListing: async (listing_id) => {
    const response = await api.get(`/applications/renters/${listing_id}`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(`/applications/${id}`, { status });
    return response.data;
  },

  // Renter confirm application
  confirm: async (id) => {
    const response = await api.post(
      `/agreements/../applications/${id}/confirm`,
    );
    return response.data;
  },

  // Renter cancel application
  cancel: async (id, reason) => {
    const response = await api.post(
      `/agreements/../applications/${id}/cancel`,
      { reason },
    );
    return response.data;
  },
};

// Admin Services
export const adminService = {
  getUsers: async () => {
    const response = await api.get("/admin/users");
    return response.data;
  },

  verifyUser: async (userId) => {
    const response = await api.patch(`/admin/users/${userId}/verify`);
    return response.data;
  },

  verifyListing: async (listingId) => {
    const response = await api.patch(`/admin/listings/${listingId}/verify`);
    return response.data;
  },

  rejectListing: async (listingId, rejection_reason = null) => {
    const response = await api.patch(`/admin/listings/${listingId}/reject`, {
      rejection_reason,
    });
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  generateReports: async () => {
    const response = await api.get("/admin/reports");
    return response.data;
  },
};

// Site-wide stats used by homepage
export const statsService = {
  getStats: async () => {
    const response = await api.get("/stats");
    return response.data;
  },
};

// Review Services
export const reviewService = {
  create: async (reviewData) => {
    const response = await api.post("/reviews", reviewData);
    return response.data;
  },

  getByListing: async (listingId) => {
    const response = await api.get(`/reviews/${listingId}`);
    return response.data;
  },

  update: async (reviewId, reviewData) => {
    const response = await api.put(`/reviews/${reviewId}`, reviewData);
    return response.data;
  },

  delete: async (reviewId) => {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  },

  getAll: async (page = 1, limit = 20) => {
    const response = await api.get("/reviews/admin/all", {
      params: { page, limit },
    });
    return response.data;
  },
};

// Owner Review Services (separate from listing reviews)
export const ownerReviewService = {
  create: async (reviewData) => {
    const response = await api.post("/owner-reviews", reviewData);
    return response.data;
  },

  getByOwner: async (ownerId) => {
    const response = await api.get(`/owner-reviews/${ownerId}`);
    return response.data;
  },

  getAll: async (page = 1, limit = 20) => {
    const response = await api.get("/owner-reviews/admin/all", {
      params: { page, limit },
    });
    return response.data;
  },
};

// Concern Services
export const concernService = {
  create: async (concernData) => {
    const response = await api.post("/concerns", concernData);
    return response.data;
  },

  getOwnConcerns: async (page = 1, limit = 20, status) => {
    const response = await api.get("/concerns", {
      params: { page, limit, status },
    });
    return response.data;
  },

  getDetail: async (concernId) => {
    const response = await api.get(`/concerns/${concernId}`);
    return response.data;
  },

  getAll: async (page = 1, limit = 20, status) => {
    const response = await api.get("/concerns/admin/all", {
      params: { page, limit, status },
    });
    return response.data;
  },

  respond: async (concernId, responseData) => {
    const response = await api.patch(
      `/concerns/${concernId}/respond`,
      responseData,
    );
    return response.data;
  },

  renterReply: async (concernId, responseData) => {
    const response = await api.patch(
      `/concerns/${concernId}/renter-reply`,
      responseData,
    );
    return response.data;
  },

  resolve: async (concernId) => {
    const response = await api.patch(`/concerns/${concernId}/resolve`);
    return response.data;
  },
};

// Report Services
export const reportService = {
  generateUserActivity: async (startDate, endDate) => {
    const response = await api.post("/reports/generate/user-activity", {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  },

  generateListingVerification: async () => {
    const response = await api.post(
      "/reports/generate/listing-verification",
      {},
    );
    return response.data;
  },

  generateConcernsSummary: async (status, limit) => {
    const response = await api.post("/reports/generate/concerns-summary", {
      status,
      limit,
    });
    return response.data;
  },

  getAll: async (page = 1, limit = 20, type) => {
    const response = await api.get("/reports", {
      params: { page, limit, type },
    });
    return response.data;
  },

  getDetail: async (reportId) => {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
  },

  delete: async (reportId) => {
    const response = await api.delete(`/reports/${reportId}`);
    return response.data;
  },

  getMonthlyIncomeRecords: async (page = 1, limit = 500) => {
    const response = await api.get("/reports/monthly-income-records", {
      params: { page, limit },
    });
    return response.data;
  },
};

// Website Review Services
export const websiteReviewService = {
  submit: async (reviewData) => {
    const response = await api.post("/website-reviews", reviewData);
    return response.data;
  },

  getMine: async () => {
    const response = await api.get("/website-reviews/me");
    return response.data;
  },

  getAdminSummary: async () => {
    const response = await api.get("/website-reviews/admin/summary");
    return response.data;
  },
};

export default api;
