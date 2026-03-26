import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  authService,
  adminService,
  agreementService,
  listingService,
  reviewService,
  websiteReviewService,
  concernService,
  reportService,
  ownerReviewService,
} from "../services/api";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import AdminSidebar from "../components/AdminSidebar";

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profileDetails, setProfileDetails] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    email: "",
  });
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [selectedAvatarPreviewUrl, setSelectedAvatarPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isExportChoiceOpen, setIsExportChoiceOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setAvatarPreview(user.profilePicture || null);
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileDetails(null);
        return;
      }

      try {
        const profile = await authService.getProfile();
        setProfileDetails(profile);
      } catch (error) {
        console.error("Failed to fetch profile details:", error);
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
      }
    };
  }, [selectedAvatarPreviewUrl]);

  const handleEditChange = (e) =>
    setEditForm({ ...editForm, [e.target.name]: e.target.value });

  const computeAverage = (items) => {
    if (!Array.isArray(items) || items.length === 0) return "-";
    const ratings = items
      .map((item) => Number(item?.rating))
      .filter(
        (rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5,
      );

    if (ratings.length === 0) return "-";

    const total = ratings.reduce((sum, value) => sum + value, 0);
    return (total / ratings.length).toFixed(1);
  };

  const toMonthStayed = (moveInDate) => {
    if (!moveInDate) return "-";

    const date = new Date(moveInDate);
    if (Number.isNaN(date.getTime())) return "-";

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);

    return `${months} month${months === 1 ? "" : "s"}`;
  };

  const escapeCsvValue = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const downloadCsv = (headers, rows, filename) => {
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute("download", filename);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const formatCsvDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const formatMoney = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "-";
    return numeric.toFixed(2);
  };

  const toPaymentStatus = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "partial") return "Partial";
    return "Unpaid";
  };

  const averageRating = (items, key = "rating") => {
    if (!Array.isArray(items) || items.length === 0) return "-";
    const ratings = items
      .map((item) => Number(item?.[key]))
      .filter(
        (rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5,
      );

    if (ratings.length === 0) return "-";
    const total = ratings.reduce((sum, value) => sum + value, 0);
    return (total / ratings.length).toFixed(1);
  };

  const fetchExportData = async () => {
    const [
      users,
      agreements,
      listings,
      reviewData,
      websiteReviewData,
      incomeData,
      ownerReviewData,
    ] = await Promise.all([
      adminService.getUsers(),
      agreementService.getAll(),
      listingService.getAll(),
      reviewService.getAll(1, 5000),
      websiteReviewService.getAdminSummary(),
      reportService.getMonthlyIncomeRecords(1, 5000),
      ownerReviewService.getAll(1, 5000),
    ]);

    return {
      users: users || [],
      agreements: agreements || [],
      listings: listings || [],
      reviews: reviewData?.reviews || [],
      websiteReviews: websiteReviewData?.reviews || [],
      incomeRecords: incomeData?.records || [],
      ownerReviews: ownerReviewData?.reviews || [],
    };
  };

  const handleDownloadRentersRecordCsv = async () => {
    if (!user || user.role !== "admin") {
      toast.error("Only admin can download records");
      return;
    }

    setExporting(true);
    try {
      const { users, agreements, websiteReviews, incomeRecords } =
        await fetchExportData();

      const today = new Date();
      const exportDate = formatCsvDate(today);

      const latestAgreementByRenter = (agreements || []).reduce(
        (acc, agreement) => {
          const renterId = agreement?.renter_id || agreement?.renter?.id;
          if (!renterId) return acc;

          const agreementTime = new Date(
            agreement?.updated_at || agreement?.created_at || 0,
          ).getTime();
          if (Number.isNaN(agreementTime)) return acc;

          const current = acc[renterId];
          const currentTime = new Date(
            current?.updated_at || current?.created_at || 0,
          ).getTime();

          if (!current || agreementTime > currentTime) {
            acc[renterId] = agreement;
          }

          return acc;
        },
        {},
      );

      const agreementCountByRenter = (agreements || []).reduce((acc, item) => {
        const renterId = item?.renter_id || item?.renter?.id;
        if (!renterId) return acc;
        acc[renterId] = (acc[renterId] || 0) + 1;
        return acc;
      }, {});

      const systemReviewByUserId = (websiteReviews || []).reduce(
        (acc, review) => {
          if (!review?.id) return acc;
          acc[review.id] = Number(review.rating) || "-";
          return acc;
        },
        {},
      );

      const sortedIncomeRecords = [...(incomeRecords || [])].sort((a, b) => {
        const aDate = new Date(a?.recorded_at || 0).getTime();
        const bDate = new Date(b?.recorded_at || 0).getTime();
        return bDate - aDate;
      });

      const latestIncomeByRenter = {};

      sortedIncomeRecords.forEach((record) => {
        if (record?.renter_id && !latestIncomeByRenter[record.renter_id]) {
          latestIncomeByRenter[record.renter_id] = {
            monthlyPayment: formatMoney(record?.total_payment),
          };
        }
      });

      const csvHeaders = [
        "Name",
        "Phone Numbers",
        "Email",
        "ID Type",
        "ID Number",
        "Rent Status",
        "Account Status",
        "Monthly Payment",
        "Start Rent Date",
        "Due Date",
        "System Rating",
        "Account Created",
        "Date",
      ];

      const csvRows = (users || [])
        .filter((item) => String(item?.role || "").toLowerCase() === "renter")
        .map((item) => {
          const userId = item.id;
          const latestAgreement = latestAgreementByRenter[userId] || null;
          const hasApplied = Number(agreementCountByRenter[userId] || 0) > 0;

          return {
            Name: item.full_name || item.fullName || "Unknown",
            "Phone Numbers": item.phone || "-",
            Email: item.email || "-",
            "ID Type": String(item.id_type || "-").replaceAll("_", " "),
            "ID Number": item.id_number || "-",
            "Rent Status": hasApplied ? "Applied" : "Not Applied",
            "Account Status": item.verified ? "Verified" : "Pending",
            "Monthly Payment":
              latestIncomeByRenter[userId]?.monthlyPayment || "-",
            "Start Rent Date": formatCsvDate(
              latestAgreement?.renter_confirmed_at,
            ),
            "Due Date": formatCsvDate(latestAgreement?.due_date),
            "System Rating": Number.isFinite(
              Number(systemReviewByUserId[userId]),
            )
              ? Number(systemReviewByUserId[userId]).toFixed(1)
              : "-",
            "Account Created": formatCsvDate(item.created_at),
            Date: exportDate,
          };
        })
        .sort((a, b) => String(a.Name).localeCompare(String(b.Name)));

      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      downloadCsv(csvHeaders, csvRows, `renters-records-${stamp}.csv`);
      toast.success("Renters record CSV downloaded");
    } catch (error) {
      console.error("Failed to generate renters record CSV:", error);
      toast.error("Failed to download renters record CSV");
    } finally {
      setExporting(false);
      setIsExportChoiceOpen(false);
    }
  };

  const handleDownloadOwnersRecordCsv = async () => {
    if (!user || user.role !== "admin") {
      toast.error("Only admin can download records");
      return;
    }

    setExporting(true);
    try {
      const {
        users,
        agreements,
        listings,
        reviews,
        incomeRecords,
        ownerReviews,
      } = await fetchExportData();

      const today = new Date();
      const exportDate = formatCsvDate(today);

      const owners = (users || []).filter(
        (item) => String(item?.role || "").toLowerCase() === "owner",
      );

      const listingByOwner = (listings || []).reduce((acc, listing) => {
        const ownerId =
          listing?.ownerId || listing?.owner?.id || listing?.owner_id || null;
        if (!ownerId) return acc;
        if (!acc[ownerId]) acc[ownerId] = [];
        acc[ownerId].push(listing);
        return acc;
      }, {});

      const occupiedByListing = (agreements || []).reduce((acc, agreement) => {
        const status = String(agreement?.status || "").toLowerCase();
        if (!["confirmed", "active"].includes(status)) return acc;

        const listingId = agreement?.listing_id || agreement?.listing?.id;
        if (!listingId) return acc;
        acc[listingId] = (acc[listingId] || 0) + 1;
        return acc;
      }, {});

      const reviewsByListing = (reviews || []).reduce((acc, review) => {
        const listingId = review?.listing_id || review?.listing?.id;
        if (!listingId) return acc;
        if (!acc[listingId]) acc[listingId] = [];
        acc[listingId].push(review);
        return acc;
      }, {});

      const ownerProfileRatings = (ownerReviews || []).reduce((acc, review) => {
        const ownerId = review?.owner_id;
        if (!ownerId) return acc;
        if (!acc[ownerId]) acc[ownerId] = [];
        acc[ownerId].push(review);
        return acc;
      }, {});

      const sortedIncomeRecords = [...(incomeRecords || [])].sort((a, b) => {
        const aDate = new Date(a?.recorded_at || 0).getTime();
        const bDate = new Date(b?.recorded_at || 0).getTime();
        return bDate - aDate;
      });

      const latestIncomeByOwner = {};
      sortedIncomeRecords.forEach((record) => {
        if (record?.owner_id && !latestIncomeByOwner[record.owner_id]) {
          latestIncomeByOwner[record.owner_id] = toPaymentStatus(
            record?.payment_type,
          );
        }
      });

      const rows = owners.flatMap((owner) => {
        const ownerId = owner.id;
        const ownerListings = listingByOwner[ownerId] || [];
        const profileRating = averageRating(ownerProfileRatings[ownerId]);
        const paymentStatus = latestIncomeByOwner[ownerId] || "Unpaid";

        if (ownerListings.length === 0) {
          return [
            {
              Name: owner.full_name || owner.fullName || "Unknown",
              "Phone Numbers": owner.phone || "-",
              Email: owner.email || "-",
              "ID Type": String(owner.id_type || "-").replaceAll("_", " "),
              "ID Number": owner.id_number || "-",
              "Title Boarding House": "-",
              "Price of Boarding House": "-",
              "Occupied Slot": 0,
              "Boarding House Rating": "-",
              "Profile Rating": profileRating,
              "Payment Status": paymentStatus,
              "Account Created": formatCsvDate(owner.created_at),
              Date: exportDate,
            },
          ];
        }

        return ownerListings.map((listing) => ({
          Name: owner.full_name || owner.fullName || "Unknown",
          "Phone Numbers": owner.phone || "-",
          Email: owner.email || "-",
          "ID Type": String(owner.id_type || "-").replaceAll("_", " "),
          "ID Number": owner.id_number || "-",
          "Title Boarding House": listing?.title || "Untitled Listing",
          "Price of Boarding House": formatMoney(listing?.price),
          "Occupied Slot": Number(occupiedByListing[listing?.id] || 0),
          "Boarding House Rating": averageRating(reviewsByListing[listing?.id]),
          "Profile Rating": profileRating,
          "Payment Status": paymentStatus,
          "Account Created": formatCsvDate(owner.created_at),
          Date:
            formatCsvDate(listing?.created_at || listing?.createdAt) ||
            exportDate,
        }));
      });

      const csvHeaders = [
        "Name",
        "Phone Numbers",
        "Email",
        "ID Type",
        "ID Number",
        "Title Boarding House",
        "Price of Boarding House",
        "Occupied Slot",
        "Boarding House Rating",
        "Profile Rating",
        "Payment Status",
        "Account Created",
        "Date",
      ];

      const sortedRows = rows.sort((a, b) =>
        String(a.Name).localeCompare(String(b.Name)),
      );

      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      downloadCsv(csvHeaders, sortedRows, `owners-records-${stamp}.csv`);
      toast.success("Owners record CSV downloaded");
    } catch (error) {
      console.error("Failed to generate owners record CSV:", error);
      toast.error("Failed to download owners record CSV");
    } finally {
      setExporting(false);
      setIsExportChoiceOpen(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    // Validate MIME type
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
    }

    setSelectedAvatarFile(file);
    setSelectedAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const openEditModal = () => {
    setEditForm({
      fullName: profileDetails?.fullName || profileDetails?.full_name || "",
      phone: profileDetails?.phone || "",
      email: profileDetails?.email || user?.email || "",
    });
    setSelectedAvatarFile(null);
    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
      setSelectedAvatarPreviewUrl("");
    }
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (loading) return;
    setIsEditModalOpen(false);
    setSelectedAvatarFile(null);
    if (selectedAvatarPreviewUrl) {
      URL.revokeObjectURL(selectedAvatarPreviewUrl);
      setSelectedAvatarPreviewUrl("");
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const trimmedEmail = editForm.email?.trim();
      if (!trimmedEmail) {
        toast.error("Email is required");
        setLoading(false);
        return;
      }

      const res = await authService.updateProfile({
        fullName: editForm.fullName,
        phone: editForm.phone,
        email: trimmedEmail,
      });

      if (selectedAvatarFile) {
        const formData = new FormData();
        formData.append("file", selectedAvatarFile);
        await authService.uploadAvatarMultipart(formData);
      }

      toast.success(res.message || "Profile updated");
      if (refreshUser) await refreshUser();

      const profile = await authService.getProfile();
      setProfileDetails(profile);
      setAvatarPreview(
        profile?.profilePicture || profile?.profile_picture || null,
      );

      setIsEditModalOpen(false);
      setSelectedAvatarFile(null);
      if (selectedAvatarPreviewUrl) {
        URL.revokeObjectURL(selectedAvatarPreviewUrl);
        setSelectedAvatarPreviewUrl("");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update profile",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReturnDashboard = () => {
    if (user?.role === "renter" || user?.role === "owner") {
      navigate("/dashboard");
    }
  };

  const resolveValue = (...values) => {
    const value = values.find(
      (item) => item !== undefined && item !== null && item !== "",
    );
    return value ?? "-";
  };

  const formatRegisteredDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const profileInfo = {
    profilePicture: resolveValue(
      profileDetails?.profilePicture,
      profileDetails?.profile_picture,
      avatarPreview,
      user?.profilePicture,
    ),
    fullName: resolveValue(
      profileDetails?.fullName,
      profileDetails?.full_name,
      user?.fullName,
    ),
    phone: resolveValue(profileDetails?.phone, user?.phone),
    idType: resolveValue(profileDetails?.idType, profileDetails?.id_type),
    createdAt: formatRegisteredDate(
      resolveValue(profileDetails?.createdAt, profileDetails?.created_at),
    ),
    email: resolveValue(profileDetails?.email, user?.email),
    role: resolveValue(profileDetails?.role, user?.role),
    idNumber: resolveValue(profileDetails?.idNumber, profileDetails?.id_number),
    verification:
      profileDetails?.verified === true || user?.verified === true
        ? "Verified"
        : "Not Verified",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {user?.role === "admin" ? (
        <AdminSidebar />
      ) : user?.role === "owner" ? (
        <OwnerSidebar />
      ) : (
        <RenterSidebar />
      )}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <h2 className="text-2xl font-bold mb-4">My Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-44 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center mb-4 border border-gray-200">
                {profileInfo.profilePicture !== "-" ? (
                  <img
                    src={profileInfo.profilePicture}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500">No photo</div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Name
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {profileInfo.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Phone Number
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {profileInfo.phone}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    ID Type
                  </p>
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {String(profileInfo.idType).replaceAll("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Date Registered
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {profileInfo.createdAt}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Email
                  </p>
                  <p className="text-sm font-medium text-gray-800 break-all">
                    {profileInfo.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Role
                  </p>
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {profileInfo.role}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    ID Number
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {profileInfo.idNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Verification
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      profileInfo.verification === "Verified"
                        ? "text-green-700"
                        : "text-amber-700"
                    }`}
                  >
                    {profileInfo.verification}
                  </p>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={openEditModal}
                  className="btn-primary"
                  disabled={loading || exporting}
                >
                  Edit Profile
                </button>

                {(user?.role === "renter" || user?.role === "owner") && (
                  <button
                    type="button"
                    onClick={handleReturnDashboard}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    disabled={loading || exporting}
                  >
                    Return to Dashboard
                  </button>
                )}

                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={() => setIsExportChoiceOpen(true)}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    disabled={loading || exporting}
                  >
                    {exporting ? "Downloading..." : "Download Overall Records"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Edit Profile
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  name="fullName"
                  value={editForm.fullName}
                  onChange={handleEditChange}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="input-field w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Profile Picture
                </label>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-24 w-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                    {selectedAvatarPreviewUrl ? (
                      <img
                        src={selectedAvatarPreviewUrl}
                        alt="New avatar preview"
                        className="h-full w-full object-cover"
                      />
                    ) : profileInfo.profilePicture !== "-" ? (
                      <img
                        src={profileInfo.profilePicture}
                        alt="Current avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-gray-500 text-center px-1">
                        No photo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    {selectedAvatarPreviewUrl
                      ? "Previewing selected photo"
                      : "Current profile photo"}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="sr-only"
                  />
                  <div className="inline-flex items-center px-3 py-2 rounded-md bg-primary-50 text-primary-700 text-sm font-semibold border border-transparent hover:bg-primary-100 transition">
                    Change photo
                  </div>
                </label>
                {selectedAvatarFile && (
                  <p className="mt-2 text-xs text-gray-600">
                    Selected: {selectedAvatarFile.name}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportChoiceOpen && user?.role === "admin" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Download Overall Records
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              Choose which record you want to export.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDownloadRentersRecordCsv}
                className="w-full px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={exporting}
              >
                {exporting ? "Downloading..." : "Renters Record"}
              </button>

              <button
                type="button"
                onClick={handleDownloadOwnersRecordCsv}
                className="w-full px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={exporting}
              >
                {exporting ? "Downloading..." : "Owners Record"}
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => !exporting && setIsExportChoiceOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={exporting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProfilePage;
