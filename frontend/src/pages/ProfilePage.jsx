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
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ fullName: user.fullName || "", phone: user.phone || "" });
      setAvatarPreview(user.profilePicture || null);
    }
  }, [user]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await authService.updateProfile({
        fullName: form.fullName,
        phone: form.phone,
      });
      toast.success(res.message || "Profile updated");
      if (refreshUser) await refreshUser();

      if (user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

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

  const handleDownloadOverallRecordCsv = async () => {
    if (!user || user.role !== "admin") {
      toast.error("Only admin can download overall records");
      return;
    }

    setExporting(true);
    try {
      const [
        users,
        agreements,
        listings,
        reviewData,
        websiteReviewData,
        concernsData,
        incomeData,
      ] = await Promise.all([
        adminService.getUsers(),
        agreementService.getAll(),
        listingService.getAll(),
        reviewService.getAll(1, 5000),
        websiteReviewService.getAdminSummary(),
        concernService.getAll(1, 5000),
        reportService.getMonthlyIncomeRecords(1, 5000),
      ]);

      const ownerIds = (users || [])
        .filter((item) => item?.role === "owner" && item?.id)
        .map((item) => item.id);

      const ownerReviewBatches = await Promise.all(
        ownerIds.map((ownerId) =>
          ownerReviewService.getByOwner(ownerId).catch(() => ({ reviews: [] })),
        ),
      );

      const ownerReviews = ownerReviewBatches.flatMap(
        (batch) => batch?.reviews || [],
      );
      const reviews = reviewData?.reviews || [];
      const websiteReviews = websiteReviewData?.reviews || [];
      const concerns = concernsData?.concerns || [];
      const incomeRecords = incomeData?.records || [];

      const postedBhCountByOwner = (listings || []).reduce((acc, listing) => {
        const ownerId =
          listing?.ownerId || listing?.owner?.id || listing?.owner_id;
        if (!ownerId) return acc;
        acc[ownerId] = (acc[ownerId] || 0) + 1;
        return acc;
      }, {});

      const renterEarliestMoveIn = (agreements || []).reduce(
        (acc, agreement) => {
          const renterId = agreement?.renter_id || agreement?.renter?.id;
          const status = String(agreement?.status || "").toLowerCase();
          const moveInDate = agreement?.renter_confirmed_at;

          if (!renterId || !moveInDate) return acc;
          if (!["confirmed", "active"].includes(status)) return acc;

          const current = acc[renterId];
          const moveInTime = new Date(moveInDate).getTime();
          if (Number.isNaN(moveInTime)) return acc;

          if (!current || moveInTime < new Date(current).getTime()) {
            acc[renterId] = moveInDate;
          }
          return acc;
        },
        {},
      );

      const reviewsByRenter = reviews.reduce((acc, review) => {
        const renterId = review?.renter_id;
        if (!renterId) return acc;
        if (!acc[renterId]) acc[renterId] = [];
        acc[renterId].push(review);
        return acc;
      }, {});

      const reviewsByOwner = reviews.reduce((acc, review) => {
        const ownerId = review?.listings?.owner?.id;
        if (!ownerId) return acc;
        if (!acc[ownerId]) acc[ownerId] = [];
        acc[ownerId].push(review);
        return acc;
      }, {});

      const ownerRatesReceivedByOwner = ownerReviews.reduce((acc, review) => {
        const ownerId = review?.owner_id;
        if (!ownerId) return acc;
        if (!acc[ownerId]) acc[ownerId] = [];
        acc[ownerId].push(review);
        return acc;
      }, {});

      const ownerRatesGivenByRenter = ownerReviews.reduce((acc, review) => {
        const renterId = review?.renter_id;
        if (!renterId) return acc;
        if (!acc[renterId]) acc[renterId] = [];
        acc[renterId].push(review);
        return acc;
      }, {});

      const systemReviewByUserId = websiteReviews.reduce((acc, review) => {
        if (!review?.id) return acc;
        acc[review.id] = Number(review.rating) || "-";
        return acc;
      }, {});

      const concernCountsByRenter = concerns.reduce((acc, concern) => {
        const renterId = concern?.renter_id || concern?.users?.id;
        if (!renterId) return acc;

        if (!acc[renterId]) {
          acc[renterId] = { resolved: 0, pending: 0, review: 0 };
        }

        const status = String(concern?.status || "").toLowerCase();
        if (status === "resolved") acc[renterId].resolved += 1;
        else if (status === "pending") acc[renterId].pending += 1;
        else if (status === "reviewed") acc[renterId].review += 1;

        return acc;
      }, {});

      const sortedIncomeRecords = [...incomeRecords].sort((a, b) => {
        const aDate = new Date(a?.recorded_at || 0).getTime();
        const bDate = new Date(b?.recorded_at || 0).getTime();
        return bDate - aDate;
      });

      const latestIncomeByRenter = {};
      const latestIncomeByOwner = {};

      sortedIncomeRecords.forEach((record) => {
        const normalizedPaymentType = ["partial", "paid"].includes(
          String(record?.payment_type || "").toLowerCase(),
        )
          ? String(record.payment_type).toLowerCase()
          : "-";

        if (record?.renter_id && !latestIncomeByRenter[record.renter_id]) {
          latestIncomeByRenter[record.renter_id] = {
            paymentType: normalizedPaymentType,
            monthlyPayment: Number.isFinite(Number(record?.total_payment))
              ? Number(record.total_payment).toFixed(2)
              : "-",
          };
        }

        if (record?.owner_id && !latestIncomeByOwner[record.owner_id]) {
          latestIncomeByOwner[record.owner_id] = {
            paymentType: normalizedPaymentType,
            monthlyPayment: Number.isFinite(Number(record?.total_payment))
              ? Number(record.total_payment).toFixed(2)
              : "-",
          };
        }
      });

      const csvHeaders = [
        "Name",
        "Role",
        "Phone number",
        "Email",
        "month stayed",
        "posted BH",
        "boarding house review(1-5)",
        "system review(1-5)",
        "owner rate (1-5)",
        "type of payment (partial/paid)",
        "monthly payment",
        "concern(resolved/pending/review)",
      ];

      const csvRows = (users || [])
        .filter((item) =>
          ["renter", "owner"].includes(String(item?.role || "").toLowerCase()),
        )
        .map((item) => {
          const role = String(item.role || "").toLowerCase();
          const userId = item.id;
          const monthStayed =
            role === "renter"
              ? toMonthStayed(renterEarliestMoveIn[userId])
              : "-";
          const postedBh =
            role === "owner" ? postedBhCountByOwner[userId] || 0 : 0;

          const boardingHouseReview =
            role === "renter"
              ? computeAverage(reviewsByRenter[userId])
              : computeAverage(reviewsByOwner[userId]);

          const ownerRate =
            role === "renter"
              ? computeAverage(ownerRatesGivenByRenter[userId])
              : computeAverage(ownerRatesReceivedByOwner[userId]);

          const latestIncome =
            role === "renter"
              ? latestIncomeByRenter[userId]
              : latestIncomeByOwner[userId];

          const concernCounts = concernCountsByRenter[userId] || {
            resolved: 0,
            pending: 0,
            review: 0,
          };

          return {
            Name: item.full_name || item.fullName || "Unknown",
            Role: role === "renter" ? "Renter" : "Owner",
            "Phone number": item.phone || "-",
            Email: item.email || "-",
            "month stayed": monthStayed,
            "posted BH": postedBh,
            "boarding house review(1-5)": boardingHouseReview,
            "system review(1-5)": Number.isFinite(
              Number(systemReviewByUserId[userId]),
            )
              ? Number(systemReviewByUserId[userId]).toFixed(1)
              : "-",
            "owner rate (1-5)": ownerRate,
            "type of payment (partial/paid)": latestIncome?.paymentType || "-",
            "monthly payment": latestIncome?.monthlyPayment || "-",
            "concern(resolved/pending/review)": `resolved:${concernCounts.resolved} | pending:${concernCounts.pending} | review:${concernCounts.review}`,
          };
        })
        .sort((a, b) => String(a.Name).localeCompare(String(b.Name)));

      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      downloadCsv(csvHeaders, csvRows, `overall-records-${stamp}.csv`);
      toast.success("Overall record CSV downloaded");
    } catch (error) {
      console.error("Failed to generate overall record CSV:", error);
      toast.error("Failed to download overall record CSV");
    } finally {
      setExporting(false);
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

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    // Use the new multipart endpoint
    authService
      .uploadAvatarMultipart(formData)
      .then((res) => {
        toast.success(res.message || "Avatar uploaded");
        setAvatarPreview(
          res.user?.profilePicture || res.user?.profile_picture || null,
        );
        if (refreshUser) refreshUser();
      })
      .catch((err) => {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to upload avatar",
        );
      })
      .finally(() => {
        setLoading(false);
      });
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
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500">No photo</div>
                )}
              </div>
              <div className="w-full flex justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="sr-only"
                  />
                  <div className="inline-flex items-center px-3 py-2 rounded-md bg-primary-50 text-primary-700 text-sm font-semibold border border-transparent hover:bg-primary-100 transition">
                    Choose photo
                  </div>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={loading || exporting}
                >
                  Save
                </button>

                {user?.role === "admin" && (
                  <button
                    type="button"
                    onClick={handleDownloadOverallRecordCsv}
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
      <Footer />
    </div>
  );
};

export default ProfilePage;
