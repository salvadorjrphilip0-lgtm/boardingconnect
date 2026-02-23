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
import { adminService, listingService } from "../services/api";
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
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [allListings, setAllListings] = useState([]);

  // rental data for admin
  const [agreements, setAgreements] = useState([]);
  const [rentSummary, setRentSummary] = useState({ daily: {}, monthly: {} });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, renters, listings
  const [imageModalOpen, setImageModalOpen] = useState(false);
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

  // when renter tab is selected we also load rental info
  useEffect(() => {
    if (activeTab === "renters") {
      fetchRentalData();
    }
  }, [activeTab]);

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
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRentalData = async () => {
    try {
      const allAgreements = await adminService.getAgreements();
      setAgreements(allAgreements);
      const summary = await adminService.getSummary();
      setRentSummary(summary);
    } catch (err) {
      console.error("Failed to fetch rental data:", err);
    }
  };

  const handleVerifyUser = async (userId) => {
    try {
      await adminService.verifyUser(userId);
      toast.success("User verified successfully");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to verify user");
    }
  };

  const handleVerifyListing = async (listingId) => {
    try {
      await adminService.verifyListing(listingId);
      toast.success("Listing verified successfully");
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
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to decline listing");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await adminService.deleteUser(userId);
      toast.success("User deleted successfully");
      fetchAdminData();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

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
              onClick={() => setActiveTab("renters")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "renters"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Renter's Account
            </button>
            <button
              onClick={() => setActiveTab("owners")}
              className={`px-6 py-3 font-semibold ${
                activeTab === "owners"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              BH Owners
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
                      <p className="text-3xl font-bold text-gray-900">0</p>
                    </div>
                    <BarChart className="h-12 w-12 text-green-600" />
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
                            {!user.verified && (
                              <button
                                onClick={() => handleVerifyUser(user.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Verify
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
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
                              onClick={() => handleVerifyListing(listing.id)}
                              className="btn-primary text-sm"
                            >
                              Verify Listing
                            </button>
                            <button
                              onClick={() => handleDeclineListing(listing.id)}
                              className="text-red-600 hover:text-red-900 text-sm"
                            >
                              Decline
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

          {/* Renters Tab */}
          {activeTab === "renters" && (
            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Renters Account Details & Rentals
              </h2>
              {/* summary info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Rental Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div>
                    <strong>Daily</strong>
                    <pre className="text-xs bg-gray-100 p-2 rounded">
                      {" "}
                      {JSON.stringify(rentSummary.daily, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>Monthly</strong>
                    <pre className="text-xs bg-gray-100 p-2 rounded">
                      {" "}
                      {JSON.stringify(rentSummary.monthly, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {users.filter((u) => u.role === "renter").length > 0 ? (
                <>
                  <div className="space-y-4">
                    {users
                      .filter((u) => u.role === "renter")
                      .map((renter) => (
                        <div
                          key={renter.id}
                          className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="grid md:grid-cols-4 gap-6">
                            {/* ID Picture */}
                            <div className="flex flex-col items-center">
                              {renter.id_image || renter.id_image_path ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openImageModal(
                                      [renter.id_image || renter.id_image_path],
                                      0,
                                      `${renter.full_name} ID`,
                                    )
                                  }
                                  className="mb-2"
                                >
                                  <img
                                    src={
                                      renter.id_image || renter.id_image_path
                                    }
                                    alt="ID"
                                    className="w-32 h-40 object-cover rounded border border-gray-300"
                                  />
                                </button>
                              ) : (
                                <div className="w-32 h-40 bg-gray-200 rounded border border-gray-300 mb-2 flex items-center justify-center">
                                  <span className="text-gray-500 text-sm">
                                    No ID Image
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="md:col-span-3">
                              <div className="grid md:grid-cols-2 gap-4">
                                {/* Name */}
                                <div>
                                  <p className="text-sm text-gray-600">Name</p>
                                  <p className="font-semibold text-gray-900">
                                    {renter.full_name || "N/A"}
                                  </p>
                                </div>

                                {/* Email */}
                                <div>
                                  <p className="text-sm text-gray-600">Email</p>
                                  <p className="font-semibold text-gray-900">
                                    {renter.email || "N/A"}
                                  </p>
                                </div>

                                {/* Phone */}
                                <div>
                                  <p className="text-sm text-gray-600">Phone</p>
                                  <p className="font-semibold text-gray-900">
                                    {renter.phone || "N/A"}
                                  </p>
                                </div>

                                {/* ID Type */}
                                <div>
                                  <p className="text-sm text-gray-600">
                                    ID Type
                                  </p>
                                  <p className="font-semibold text-gray-900">
                                    {renter.id_type || "N/A"}
                                  </p>
                                </div>

                                {/* ID Number */}
                                <div>
                                  <p className="text-sm text-gray-600">
                                    ID Number
                                  </p>
                                  <p className="font-semibold text-gray-900">
                                    {renter.id_number || "N/A"}
                                  </p>
                                </div>

                                {/* Date Created */}
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Date Created
                                  </p>
                                  <p className="font-semibold text-gray-900">
                                    {new Date(
                                      renter.created_at,
                                    ).toLocaleDateString()}
                                  </p>
                                </div>

                                {/* Status */}
                                <div>
                                  <p className="text-sm text-gray-600">
                                    Verification Status
                                  </p>
                                  {renter.verified ? (
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
                          </div>
                        </div>
                      ))}
                  </div>

                  {agreements && agreements.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        All Rental Agreements
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Renter
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Owner
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Listing
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rent Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {agreements.map((agr) => (
                              <tr key={agr.id}>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                  {agr.renter?.full_name || "-"}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                  {agr.owner?.full_name || "-"}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-700">
                                  {agr.listing?.title || "-"}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                                  {agr.rent_status || "due"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  No renter users found
                </p>
              )}
            </div>
          )}

          {/* Owners Tab */}
          {activeTab === "owners" && (
            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                BH Owners Account Details
              </h2>
              {users.filter((u) => u.role === "owner").length > 0 ? (
                <div className="space-y-4">
                  {users
                    .filter((u) => u.role === "owner")
                    .map((owner) => (
                      <div
                        key={owner.id}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="grid md:grid-cols-4 gap-6">
                          {/* ID Picture */}
                          <div className="flex flex-col items-center">
                            {owner.id_image || owner.id_image_path ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openImageModal(
                                    [owner.id_image || owner.id_image_path],
                                    0,
                                    `${owner.full_name} ID`,
                                  )
                                }
                                className="mb-2"
                              >
                                <img
                                  src={owner.id_image || owner.id_image_path}
                                  alt="ID"
                                  className="w-32 h-40 object-cover rounded border border-gray-300"
                                />
                              </button>
                            ) : (
                              <div className="w-32 h-40 bg-gray-200 rounded border border-gray-300 mb-2 flex items-center justify-center">
                                <span className="text-gray-500 text-sm">
                                  No ID Image
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="md:col-span-3">
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Name */}
                              <div>
                                <p className="text-sm text-gray-600">Name</p>
                                <p className="font-semibold text-gray-900">
                                  {owner.full_name || "N/A"}
                                </p>
                              </div>

                              {/* Email */}
                              <div>
                                <p className="text-sm text-gray-600">Email</p>
                                <p className="font-semibold text-gray-900">
                                  {owner.email || "N/A"}
                                </p>
                              </div>

                              {/* Phone */}
                              <div>
                                <p className="text-sm text-gray-600">Phone</p>
                                <p className="font-semibold text-gray-900">
                                  {owner.phone || "N/A"}
                                </p>
                              </div>

                              {/* ID Type */}
                              <div>
                                <p className="text-sm text-gray-600">ID Type</p>
                                <p className="font-semibold text-gray-900">
                                  {owner.id_type || "N/A"}
                                </p>
                              </div>

                              {/* ID Number */}
                              <div>
                                <p className="text-sm text-gray-600">
                                  ID Number
                                </p>
                                <p className="font-semibold text-gray-900">
                                  {owner.id_number || "N/A"}
                                </p>
                              </div>

                              {/* Date Created */}
                              <div>
                                <p className="text-sm text-gray-600">
                                  Date Created
                                </p>
                                <p className="font-semibold text-gray-900">
                                  {owner.created_at
                                    ? new Date(
                                        owner.created_at,
                                      ).toLocaleDateString()
                                    : "-"}
                                </p>
                              </div>

                              {/* Status */}
                              <div>
                                <p className="text-sm text-gray-600">
                                  Verification Status
                                </p>
                                {owner.verified ? (
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
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  No owner users found
                </p>
              )}
            </div>
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
                            <p className="font-semibold text-gray-900">
                              {listing.location}
                            </p>
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
