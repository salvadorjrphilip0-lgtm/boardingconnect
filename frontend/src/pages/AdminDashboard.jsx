import { useState, useEffect } from "react";
import {
  Users,
  Home,
  FileText,
  CheckCircle,
  XCircle,
  BarChart,
  MapPin,
  // removed DollarSign - using Peso symbol instead
} from "lucide-react";
import {
  adminService,
  listingService,
  reviewService,
  websiteReviewService,
} from "../services/api";
import AdminSidebar from "../components/AdminSidebar";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const AdminDashboard = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    pendingVerifications: 0,
  });
  const [reviewStats, setReviewStats] = useState({
    boardingHouse: {
      total_reviews: 0,
      average_rating: 0,
      star_counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    system: {
      total_reviews: 0,
      average_rating: 0,
    },
  });
  const [systemRoleRatings, setSystemRoleRatings] = useState({
    renter: 0,
    owner: 0,
  });
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [allListings, setAllListings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, listings
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [userReviewModalOpen, setUserReviewModalOpen] = useState(false);
  const [selectedUserForReview, setSelectedUserForReview] = useState(null);
  const [listingReviewModalOpen, setListingReviewModalOpen] = useState(false);
  const [selectedListingForReview, setSelectedListingForReview] =
    useState(null);
  const [showListingLocationMap, setShowListingLocationMap] = useState(false);
  const [listingMapPin, setListingMapPin] = useState(null);
  const [listingMapLoading, setListingMapLoading] = useState(false);
  const [listingMapError, setListingMapError] = useState("");
  const [listingLocationOpeningId, setListingLocationOpeningId] =
    useState(null);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageAlt, setModalImageAlt] = useState("");
  const [modalImageList, setModalImageList] = useState([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // Helper: resolve owner full name from possible shapes
  const resolveOwnerName = (listing) => {
    if (!listing) return "Unknown";
    // Direct fields first
    const direct =
      listing.owner?.full_name ||
      listing.owner_full_name ||
      listing.owner_name ||
      listing.user?.full_name ||
      listing.user_full_name ||
      listing.posted_by?.full_name ||
      listing.created_by?.full_name ||
      listing.owner?.name;
    if (direct) return direct;

    // Try to resolve by ID using the users list fetched for admin
    const possibleOwnerIds = [
      listing.owner_id,
      listing.user_id,
      listing.owner?.id,
      listing.user?.id,
      listing.posted_by_id,
      listing.created_by,
    ].filter(Boolean);

    for (const id of possibleOwnerIds) {
      const u = users.find((x) => x.id === id);
      if (u) return u.full_name || u.fullName || u.name || "Unknown";
    }

    return "Unknown";
  };

  // Helper: safe date formatter that checks multiple fields
  const formatListingDate = (listing) => {
    if (!listing) return "-";
    const candidates = [
      listing.created_at,
      listing.createdAt,
      listing.created,
      listing.date_created,
      listing.posted_at,
    ];
    for (const c of candidates) {
      if (!c) continue;
      const d = new Date(c);
      if (!isNaN(d)) return d.toLocaleDateString();
    }
    return "-";
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setImageModalOpen(false);
      if (e.key === "ArrowRight") {
        if (imageModalOpen) goNextImage();
      }
      if (e.key === "ArrowLeft") {
        if (imageModalOpen) goPrevImage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchAdminData = async () => {
    try {
      const usersData = await adminService.getUsers();
      setUsers(usersData);
      setStats({
        totalUsers: usersData.length,
        totalListings: 0,
        pendingVerifications: usersData.filter((u) => !u.verified).length,
      });
      // Fetch listings and compute pending verifications
      try {
        const allListingsData = await listingService.getAll();
        if (allListingsData) {
          const pending = allListingsData.filter(
            (l) =>
              (l.status && l.status === "pending") ||
              (!l.status && !l.verified),
          );
          setListings(pending);
          setAllListings(allListingsData);
          setStats((prev) => ({
            ...prev,
            totalListings: allListingsData.length,
            pendingVerifications: pending.length,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch listings for admin:", err);
      }

      try {
        const [boardingHouseReviewData, systemReviewData] = await Promise.all([
          reviewService.getAll(1, 1000),
          websiteReviewService.getAdminSummary(),
        ]);

        setReviewStats({
          boardingHouse: {
            total_reviews:
              Number(boardingHouseReviewData?.pagination?.total) ||
              (boardingHouseReviewData?.reviews || []).length ||
              0,
            average_rating:
              Number(boardingHouseReviewData?.average_rating) || 0,
            star_counts: boardingHouseReviewData?.star_counts || {
              1: 0,
              2: 0,
              3: 0,
              4: 0,
              5: 0,
            },
          },
          system: {
            total_reviews:
              Number(systemReviewData?.summary?.total_reviews) || 0,
            average_rating:
              Number(systemReviewData?.summary?.average_rating) || 0,
          },
        });

        const systemReviewList = Array.isArray(systemReviewData?.reviews)
          ? systemReviewData.reviews
          : [];

        const roleAggregates = systemReviewList.reduce(
          (acc, review) => {
            const role = String(review?.role || "").toLowerCase();
            const rating = Number(review?.rating) || 0;

            if (role === "renter") {
              acc.renter.sum += rating;
              acc.renter.count += 1;
            }

            if (role === "owner") {
              acc.owner.sum += rating;
              acc.owner.count += 1;
            }

            return acc;
          },
          {
            renter: { sum: 0, count: 0 },
            owner: { sum: 0, count: 0 },
          },
        );

        setSystemRoleRatings({
          renter:
            roleAggregates.renter.count > 0
              ? Number(
                  (
                    roleAggregates.renter.sum / roleAggregates.renter.count
                  ).toFixed(1),
                )
              : 0,
          owner:
            roleAggregates.owner.count > 0
              ? Number(
                  (
                    roleAggregates.owner.sum / roleAggregates.owner.count
                  ).toFixed(1),
                )
              : 0,
        });
      } catch (err) {
        console.error("Failed to fetch review insights:", err);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalReviewCount =
    (reviewStats?.boardingHouse?.total_reviews || 0) +
    (reviewStats?.system?.total_reviews || 0);

  const boardingHouseStarRows = [1, 2, 3, 4, 5].map((star) => ({
    star,
    total: Number(reviewStats?.boardingHouse?.star_counts?.[star]) || 0,
  }));

  const maxBoardingHouseStarCount = Math.max(
    ...boardingHouseStarRows.map((item) => item.total),
    1,
  );

  const boardingHouseYAxisMax = Math.max(10, maxBoardingHouseStarCount);
  const boardingHouseYAxisTicks = [1, 0.8, 0.6, 0.4, 0.2, 0].map((ratio) =>
    Math.round(boardingHouseYAxisMax * ratio),
  );

  const systemRoleChartRows = [
    {
      label: "Renter",
      rating: Number(systemRoleRatings?.renter) || 0,
      color: "bg-emerald-500",
    },
    {
      label: "Owner",
      rating: Number(systemRoleRatings?.owner) || 0,
      color: "bg-blue-500",
    },
  ];

  const selectedListingLocation =
    selectedListingForReview?.location?.trim?.() || "";
  const selectedListingMapUrl = listingMapPin
    ? `https://www.openstreetmap.org/?mlat=${listingMapPin.lat}&mlon=${listingMapPin.lon}#map=18/${listingMapPin.lat}/${listingMapPin.lon}`
    : selectedListingLocation
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedListingLocation)}`
      : "";

  const selectedListingMapEmbedUrl = listingMapPin
    ? (() => {
        const lon = Number(listingMapPin.lon);
        const lat = Number(listingMapPin.lat);
        const delta = 0.005;
        const left = lon - delta;
        const right = lon + delta;
        const top = lat + delta;
        const bottom = lat - delta;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
      })()
    : selectedListingLocation
      ? `https://www.google.com/maps?q=${encodeURIComponent(selectedListingLocation)}&output=embed`
      : "";

  const handleVerifyUser = async (userId) => {
    try {
      await adminService.verifyUser(userId);
      toast.success("User verified successfully");
      setUserReviewModalOpen(false);
      setSelectedUserForReview(null);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to verify user");
    }
  };

  const handleVerifyListing = async (listingId) => {
    try {
      await adminService.verifyListing(listingId);
      toast.success("Listing verified successfully");
      setListingReviewModalOpen(false);
      setSelectedListingForReview(null);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to verify listing");
    }
  };

  const handleDeclineListing = async (listingId) => {
    if (
      !confirm(
        "Decline this listing? This will remove images and mark it rejected.",
      )
    )
      return;
    try {
      const reason = window.prompt(
        "Optional rejection reason (will be visible to the owner):",
        "",
      );
      // Admin can reject listings via adminService (mark as rejected)
      await adminService.rejectListing(listingId, reason || null);
      toast.success("Listing declined (marked rejected)");
      setListingReviewModalOpen(false);
      setSelectedListingForReview(null);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to decline listing");
    }
  };

  const handleDeleteListing = async (listingId) => {
    if (!confirm("Are you sure you want to delete this listing post?")) return;
    try {
      await listingService.delete(listingId);
      toast.success("Listing post deleted successfully");
      setListingReviewModalOpen(false);
      setSelectedListingForReview(null);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to delete listing post");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await adminService.deleteUser(userId);
      toast.success("User deleted successfully");
      setUserReviewModalOpen(false);
      setSelectedUserForReview(null);
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const openUserReviewModal = (userData) => {
    setSelectedUserForReview(userData);
    setUserReviewModalOpen(true);
  };

  const closeUserReviewModal = () => {
    setUserReviewModalOpen(false);
    setSelectedUserForReview(null);
  };

  const openListingReviewModal = (listingData) => {
    setShowListingLocationMap(false);
    setListingMapPin(null);
    setListingMapError("");
    setListingMapLoading(false);
    setSelectedListingForReview(listingData);
    setListingReviewModalOpen(true);
  };

  const closeListingReviewModal = () => {
    setShowListingLocationMap(false);
    setListingMapPin(null);
    setListingMapError("");
    setListingMapLoading(false);
    setListingReviewModalOpen(false);
    setSelectedListingForReview(null);
  };

  const resolveListingPin = async (locationText) => {
    const q = (locationText || "").trim();
    if (!q) return null;

    const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error("Unable to geocode location");
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return {
      lat: data[0].lat,
      lon: data[0].lon,
      displayName: data[0].display_name,
    };
  };

  const handleOpenPinnedListingMap = async (listing) => {
    const locationText = listing?.location?.trim?.();
    if (!locationText) {
      toast.error("No location available for this listing");
      return;
    }

    setListingLocationOpeningId(listing.id);
    try {
      const pin = await resolveListingPin(locationText);
      const pinnedUrl = pin
        ? `https://www.openstreetmap.org/?mlat=${pin.lat}&mlon=${pin.lon}#map=18/${pin.lat}/${pin.lon}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`;

      if (!pin) {
        toast("Pinned location not found, opening map search instead.");
      }

      window.open(pinnedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open pinned listing location:", error);
      const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`;
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      toast.error("Could not resolve exact pin, opened map search instead");
    } finally {
      setListingLocationOpeningId(null);
    }
  };

  useEffect(() => {
    const geocodeIfNeeded = async () => {
      if (
        !listingReviewModalOpen ||
        !showListingLocationMap ||
        !selectedListingLocation ||
        listingMapPin ||
        listingMapLoading
      ) {
        return;
      }

      try {
        setListingMapLoading(true);
        setListingMapError("");
        const pin = await resolveListingPin(selectedListingLocation);
        if (pin) {
          setListingMapPin(pin);
        } else {
          setListingMapError(
            "Could not find an exact pin for this address. Showing text-based map fallback.",
          );
        }
      } catch (e) {
        console.error("Failed to resolve listing map pin:", e);
        setListingMapError(
          "Unable to resolve exact pinned location. Showing text-based map fallback.",
        );
      } finally {
        setListingMapLoading(false);
      }
    };

    geocodeIfNeeded();
  }, [
    listingReviewModalOpen,
    showListingLocationMap,
    selectedListingLocation,
    listingMapPin,
    listingMapLoading,
  ]);

  const openImageModal = (listOrSrc, index = 0, altPrefix = "") => {
    // listOrSrc can be an array of urls or a single url
    const list = Array.isArray(listOrSrc) ? listOrSrc : [listOrSrc];
    const idx = Math.max(0, Math.min(index, list.length - 1));
    setModalImageList(list);
    setModalImageIndex(idx);
    setModalImageSrc(list[idx]);
    setModalImageAlt(altPrefix || `Image ${idx + 1}`);
    setImageModalOpen(true);
  };

  const goNextImage = () => {
    if (!modalImageList || modalImageList.length <= 1) return;
    const next = (modalImageIndex + 1) % modalImageList.length;
    setModalImageIndex(next);
    setModalImageSrc(modalImageList[next]);
    setModalImageAlt(`Image ${next + 1}`);
  };

  const goPrevImage = () => {
    if (!modalImageList || modalImageList.length <= 1) return;
    const prev =
      (modalImageIndex - 1 + modalImageList.length) % modalImageList.length;
    setModalImageIndex(prev);
    setModalImageSrc(modalImageList[prev]);
    setModalImageAlt(`Image ${prev + 1}`);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setModalImageSrc(null);
    setModalImageAlt("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600">
              Only administrators can view the admin dashboard.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Manage users, listings, and system reports
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-8">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "dashboard"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("listings")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "listings"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Boarding House Listings
            </button>
          </div>

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Users</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.totalUsers}
                      </p>
                    </div>
                    <Users className="h-12 w-12 text-primary-600" />
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Listings</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.totalListings}
                      </p>
                    </div>
                    <Home className="h-12 w-12 text-blue-600" />
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        Pending Verifications
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {stats.pendingVerifications}
                      </p>
                    </div>
                    <FileText className="h-12 w-12 text-yellow-600" />
                  </div>
                </div>

                <div className="card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Reports</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {totalReviewCount}
                      </p>
                    </div>
                    <BarChart className="h-12 w-12 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="card p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Overall Reviews
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm text-gray-600">
                      Overall Boarding House Reviews
                    </p>
                    <p className="text-3xl font-bold text-blue-700 mt-1">
                      {reviewStats.boardingHouse.average_rating}/5
                    </p>
                    <p className="text-sm text-blue-800 mt-1">
                      {reviewStats.boardingHouse.total_reviews} review
                      {reviewStats.boardingHouse.total_reviews === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-gray-600">
                      Overall System Reviews
                    </p>
                    <p className="text-3xl font-bold text-emerald-700 mt-1">
                      {reviewStats.system.average_rating}/5
                    </p>
                    <p className="text-sm text-emerald-800 mt-1">
                      {reviewStats.system.total_reviews} review
                      {reviewStats.system.total_reviews === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">
                    Overall Graph (Reviews)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-3 text-center">
                        Boarding House Reviews (1★ to 5★)
                      </p>

                      <div className="flex items-end gap-3">
                        <div className="h-48 w-8 flex flex-col justify-between text-[10px] text-gray-500 text-right">
                          {boardingHouseYAxisTicks.map((tick, idx) => (
                            <span key={`bh-y-axis-${idx}`}>{tick}</span>
                          ))}
                        </div>

                        <div className="flex-1 h-48 border-l border-b border-gray-300 px-4 pb-2">
                          <div className="h-full flex items-end justify-around gap-3">
                            {boardingHouseStarRows.map((item) => (
                              <div
                                key={`bh-star-${item.star}`}
                                className="flex flex-col items-center justify-end h-full"
                              >
                                <div
                                  className="w-10 rounded-t-md bg-blue-500 relative overflow-hidden"
                                  style={{
                                    height: `${Math.max(
                                      8,
                                      Math.round(
                                        (item.total / boardingHouseYAxisMax) *
                                          100,
                                      ),
                                    )}%`,
                                  }}
                                  title={`${item.star}★: ${item.total} renter review${item.total === 1 ? "" : "s"}`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                                    {item.total}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-start gap-3">
                        <div className="w-8" />
                        <div className="flex-1 px-4">
                          <div className="flex justify-around gap-3">
                            {boardingHouseStarRows.map((item) => (
                              <span
                                key={`bh-star-x-${item.star}`}
                                className="w-10 text-xs text-gray-600 text-center font-medium"
                              >
                                {item.star}★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 pl-11 pr-4">
                        <p className="text-[11px] text-gray-500 text-center">
                          X-axis: Star Rate (1–5)
                        </p>
                      </div>

                      <p className="text-[10px] text-gray-500 mt-2 text-center">
                        Y-axis: Total Renters/Reviews
                      </p>
                    </div>

                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-3 text-center">
                        System Reviews (Renter vs Owner)
                      </p>

                      <div className="flex items-end gap-3">
                        <div className="h-48 w-8 flex flex-col justify-between text-[10px] text-gray-500 text-right">
                          <span>5</span>
                          <span>4</span>
                          <span>3</span>
                          <span>2</span>
                          <span>1</span>
                          <span>0</span>
                        </div>

                        <div className="flex-1 h-48 border-l border-b border-gray-300 px-4 pb-2">
                          <div className="h-full flex items-end justify-around gap-6">
                            {systemRoleChartRows.map((item) => (
                              <div
                                key={item.label}
                                className="flex flex-col items-center justify-end h-full"
                              >
                                <div
                                  className={`w-16 rounded-t-md ${item.color} relative overflow-hidden`}
                                  style={{
                                    height: `${Math.max(
                                      8,
                                      Math.round((item.rating / 5) * 100),
                                    )}%`,
                                  }}
                                  title={`${item.label} Rating: ${item.rating}/5`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                                    {item.rating}/5
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-start gap-3">
                        <div className="w-8" />
                        <div className="flex-1 px-4">
                          <div className="flex justify-around gap-6">
                            {systemRoleChartRows.map((item) => (
                              <span
                                key={`system-x-${item.label}`}
                                className="w-16 text-xs text-gray-600 text-center font-medium"
                              >
                                {item.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-1 pl-12 pr-4">
                        <p className="text-[10px] text-gray-500 text-center">
                          X-axis: User Type (Renter, Owner)
                        </p>
                      </div>

                      <p className="text-[10px] text-gray-500 mt-2 text-center">
                        Y-axis: Total Rate (1–5)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Management */}
              <div className="card p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  User Management
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-8 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-9 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {user.full_name || user.fullName || user.fullName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.verified ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                <XCircle className="h-3 w-3 mr-1" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => openUserReviewModal(user)}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              Review Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Listing Verification */}
              <div className="card p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Listing Verifications
                </h2>
                {listings.length > 0 ? (
                  <div className="space-y-4">
                    {listings.map((listing) => (
                      <div
                        key={listing.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-gray-900">
                              {listing.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {listing.location}
                            </p>
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => openListingReviewModal(listing)}
                              className="text-primary-600 hover:text-primary-800 text-sm font-semibold"
                            >
                              Review Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-center py-8">
                    No pending listing verifications
                  </p>
                )}
              </div>
            </>
          )}

          {/* Listings Tab */}
          {activeTab === "listings" && (
            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Boarding House Details
              </h2>
              {allListings.filter((l) => l.status === "approved" || l.verified)
                .length > 0 ? (
                <div className="space-y-6">
                  {allListings
                    .filter((l) => l.status === "approved" || l.verified)
                    .map((listing) => (
                      <div
                        key={listing.id}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        {/* Header with Title and Owner */}
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-gray-900">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Owner:{" "}
                            <span className="font-semibold">
                              {listing.owner_full_name ||
                                listing.owner_name ||
                                resolveOwnerName(listing) ||
                                "Unknown"}
                            </span>
                          </p>
                        </div>

                        {/* Images gallery - show all images as clickable thumbnails */}
                        {((listing.images && listing.images.length > 0) ||
                          (listing.images_paths &&
                            listing.images_paths.length > 0)) && (
                          <div className="mb-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {(listing.images && listing.images.length > 0
                                ? listing.images
                                : listing.images_paths || []
                              ).map((img, idx, arr) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    openImageModal(arr, idx, `${listing.title}`)
                                  }
                                  className="block overflow-hidden rounded"
                                >
                                  <img
                                    src={img}
                                    alt={`${listing.title} - ${idx + 1}`}
                                    className="w-full h-32 md:h-48 object-cover rounded hover:scale-105 transition-transform"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Details Grid */}
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          {/* Description */}
                          <div className="md:col-span-2">
                            <p className="text-sm text-gray-600">Description</p>
                            <p className="text-gray-900 line-clamp-2">
                              {listing.description}
                            </p>
                          </div>

                          {/* Location */}
                          <div>
                            <p className="text-sm text-gray-600 flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              Location
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenPinnedListingMap(listing)
                              }
                              disabled={listingLocationOpeningId === listing.id}
                              className="font-semibold text-primary-700 hover:text-primary-900 underline disabled:text-gray-500 disabled:no-underline"
                            >
                              {listingLocationOpeningId === listing.id
                                ? "Locating pinned map..."
                                : listing.location}
                            </button>
                          </div>

                          {/* Price */}
                          <div>
                            <p className="text-sm text-gray-600 flex items-center">
                              <span className="h-7 w-4 mr-1 inline-block text-gray-700 text-lg">
                                ₱
                              </span>
                              Price
                            </p>
                            <p className="font-semibold text-gray-900">
                              ₱{listing.price}/month
                            </p>
                          </div>

                          {/* Capacity */}
                          <div>
                            <p className="text-sm text-gray-600 flex items-center">
                              <Users className="h-4 w-4 mr-1" />
                              Available Slots
                            </p>
                            <p className="font-semibold text-gray-900">
                              {listing.capacity}
                            </p>
                          </div>

                          {/* Status */}
                          <div>
                            <p className="text-sm text-gray-600">Status</p>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </span>
                          </div>

                          {/* Created Date */}
                          <div>
                            <p className="text-sm text-gray-600">
                              Date Created
                            </p>
                            <p className="font-semibold text-gray-900">
                              {formatListingDate(listing)}
                            </p>
                          </div>
                        </div>

                        {/* Amenities */}
                        {listing.amenities && listing.amenities.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-600 mb-2">
                              Amenities
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {listing.amenities.map((amenity, index) => (
                                <span
                                  key={index}
                                  className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold"
                                >
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  No verified listings found
                </p>
              )}
            </div>
          )}
        </div>

        <Footer />
      </div>
      {/* Image Lightbox Modal */}
      {userReviewModalOpen && selectedUserForReview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeUserReviewModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">User Review</h3>
              <button
                type="button"
                onClick={closeUserReviewModal}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 grid md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                {selectedUserForReview.id_image ? (
                  <button
                    type="button"
                    onClick={() =>
                      openImageModal(
                        [selectedUserForReview.id_image],
                        0,
                        `${selectedUserForReview.full_name || "User"} ID`,
                      )
                    }
                  >
                    <img
                      src={selectedUserForReview.id_image}
                      alt="Uploaded ID"
                      className="w-36 h-48 object-cover rounded border border-gray-300"
                    />
                  </button>
                ) : (
                  <div className="w-36 h-48 bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-gray-500 text-sm">
                    No ID uploaded
                  </div>
                )}
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Name</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.full_name || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.email || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.phone || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Role</p>
                  <p className="font-semibold text-gray-900 capitalize">
                    {selectedUserForReview.role || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">ID Type</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.id_type || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">ID Number</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.id_number || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Date Registered</p>
                  <p className="font-semibold text-gray-900">
                    {selectedUserForReview.created_at
                      ? new Date(
                          selectedUserForReview.created_at,
                        ).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Verification</p>
                  {selectedUserForReview.verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      <XCircle className="h-3 w-3 mr-1" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {!selectedUserForReview.verified && (
                <button
                  type="button"
                  onClick={() => handleVerifyUser(selectedUserForReview.id)}
                  className="btn-primary"
                >
                  Verify User
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteUser(selectedUserForReview.id)}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Delete User
              </button>
              <button
                type="button"
                onClick={closeUserReviewModal}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listing Review Modal */}
      {listingReviewModalOpen && selectedListingForReview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeListingReviewModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                Listing Review
              </h3>
              <button
                type="button"
                onClick={closeListingReviewModal}
                className="text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xl font-bold text-gray-900">
                  {selectedListingForReview.title || "Untitled Listing"}
                </h4>
                <div className="text-sm text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
                  <MapPin className="h-4 w-4" />
                  <button
                    type="button"
                    onClick={() => setShowListingLocationMap((prev) => !prev)}
                    className="text-primary-700 hover:text-primary-900 underline text-left"
                    disabled={!selectedListingLocation}
                  >
                    {selectedListingForReview.location || "No location"}
                  </button>
                  {selectedListingMapUrl && (
                    <a
                      href={selectedListingMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Open map
                    </a>
                  )}
                </div>
              </div>

              {showListingLocationMap && selectedListingMapEmbedUrl && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Location Map</p>
                  {listingMapLoading && (
                    <p className="text-xs text-gray-500 mb-2">
                      Resolving pinned location...
                    </p>
                  )}
                  {listingMapError && (
                    <p className="text-xs text-amber-600 mb-2">
                      {listingMapError}
                    </p>
                  )}
                  {listingMapPin?.displayName && (
                    <p className="text-xs text-gray-500 mb-2">
                      Pinned: {listingMapPin.displayName}
                    </p>
                  )}
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      title="Listing location map"
                      src={selectedListingMapEmbedUrl}
                      className="w-full h-72"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              )}

              {((selectedListingForReview.images || []).length > 0 ||
                (selectedListingForReview.images_paths || []).length > 0) && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Listing Images</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {((selectedListingForReview.images || []).length > 0
                      ? selectedListingForReview.images
                      : selectedListingForReview.images_paths || []
                    ).map((img, idx, arr) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          openImageModal(
                            arr,
                            idx,
                            selectedListingForReview.title,
                          )
                        }
                        className="block overflow-hidden rounded"
                      >
                        <img
                          src={img}
                          alt={`${selectedListingForReview.title} - ${idx + 1}`}
                          className="w-full h-28 object-cover rounded hover:scale-105 transition-transform"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Owner</p>
                  <p className="font-semibold text-gray-900">
                    {resolveOwnerName(selectedListingForReview)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Price</p>
                  <p className="font-semibold text-gray-900">
                    ₱{selectedListingForReview.price || 0}/month
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Available Slots</p>
                  <p className="font-semibold text-gray-900">
                    {selectedListingForReview.capacity ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Date Created</p>
                  <p className="font-semibold text-gray-900">
                    {formatListingDate(selectedListingForReview)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-semibold text-gray-900 capitalize">
                    {selectedListingForReview.status ||
                      (selectedListingForReview.verified
                        ? "approved"
                        : "pending")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Verification</p>
                  {selectedListingForReview.verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      <XCircle className="h-3 w-3 mr-1" />
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900 whitespace-pre-line">
                  {selectedListingForReview.description || "No description"}
                </p>
              </div>

              {selectedListingForReview.amenities?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedListingForReview.amenities.map((amenity, i) => (
                      <span
                        key={i}
                        className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              {!selectedListingForReview.verified && (
                <button
                  type="button"
                  onClick={() =>
                    handleVerifyListing(selectedListingForReview.id)
                  }
                  className="btn-primary"
                >
                  Verify Listing
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  handleDeclineListing(selectedListingForReview.id)
                }
                className="px-4 py-2 rounded-md bg-yellow-600 text-white hover:bg-yellow-700"
              >
                Decline Listing
              </button>
              <button
                type="button"
                onClick={() => handleDeleteListing(selectedListingForReview.id)}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Delete Post
              </button>
              <button
                type="button"
                onClick={closeListingReviewModal}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={closeImageModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeImageModal}
              className="absolute -top-8 -right-20 bg-white rounded-full p-2 shadow-lg"
              aria-label="Close image"
            >
              ✕
            </button>

            {/* Prev button */}
            {modalImageList && modalImageList.length > 1 && (
              <button
                onClick={goPrevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                aria-label="Previous image"
              >
                ‹
              </button>
            )}

            {/* Next button */}
            {modalImageList && modalImageList.length > 1 && (
              <button
                onClick={goNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                aria-label="Next image"
              >
                ›
              </button>
            )}

            <img
              src={modalImageSrc}
              alt={modalImageAlt}
              className="w-full max-h-[80vh] object-contain rounded"
            />
            {modalImageList && modalImageList.length > 1 && (
              <div className="mt-2 text-center text-sm text-gray-200">
                {modalImageIndex + 1} / {modalImageList.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
