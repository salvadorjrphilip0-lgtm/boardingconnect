import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  MapPin,
  Users,
  Edit,
  Trash2,
  Star,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  listingService,
  applicationService,
  agreementService,
  websiteReviewService,
} from "../services/api";
import OwnerSidebar from "../components/OwnerSidebar";
import RenterSidebar from "../components/RenterSidebar";
import ListingCard from "../components/ListingCard";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import {
  getPaymentStatusBadge,
  getTimeStatusBadge,
} from "../utils/renterStatus";

const toStringArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // Continue to fallback handling
    }

    if (value.includes(",")) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return value.trim() ? [value.trim()] : [];
  }

  return [];
};

const getListingImages = (listing) =>
  toStringArray(listing?.images).filter((image) => typeof image === "string");

const getListingAmenities = (listing) =>
  toStringArray(listing?.amenities).filter(
    (amenity) => typeof amenity === "string",
  );

const getRelationObject = (value) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    listings: 0,
    applications: 0,
    agreements: 0,
  });
  const [browseFilters, setBrowseFilters] = useState({
    search: "",
    location: "",
    minPrice: "",
    maxPrice: "",
    verified: false,
  });
  const [myListings, setMyListings] = useState([]);
  const [renterBrowseListings, setRenterBrowseListings] = useState([]);
  const [renterBrowseLoading, setRenterBrowseLoading] = useState(false);
  const [recentApplications, setRecentApplications] = useState([]);
  const [renterAgreements, setRenterAgreements] = useState([]);
  const [ownerAgreements, setOwnerAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWebsiteReviewModal, setShowWebsiteReviewModal] = useState(false);
  const [websiteRating, setWebsiteRating] = useState(0);
  const [websiteComment, setWebsiteComment] = useState("");
  const [submittingWebsiteReview, setSubmittingWebsiteReview] = useState(false);

  useEffect(() => {
    // Clear previous state and refetch dashboard data whenever the
    // authenticated user changes (login/logout/account switch). This
    // ensures each account sees only their own listings/applications.
    if (!user) {
      setMyListings([]);
      setRenterBrowseListings([]);
      setRecentApplications([]);
      setRenterAgreements([]);
      setOwnerAgreements([]);
      setStats({ listings: 0, applications: 0, agreements: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMyListings([]);
    setRecentApplications([]);
    setRenterAgreements([]);
    setOwnerAgreements([]);
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user || !["renter", "owner"].includes(user.role)) return;

    const checkWebsiteReview = async () => {
      try {
        const data = await websiteReviewService.getMine();
        if (!data?.rated) {
          setShowWebsiteReviewModal(true);
        }
      } catch (error) {
        console.error("Failed to check website review status:", error);
      }
    };

    checkWebsiteReview();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;

      if (user.role === "owner") {
        const listings = await listingService.getAll({ ownerId: user.id });
        setMyListings(listings);
        setStats((prev) => ({ ...prev, listings: listings.length }));
      } else if (user.role === "renter") {
        await fetchRenterBrowseListings();
      }

      // Applications fetched are scoped to the authenticated user on the server
      const applications = applicationService.getByUser
        ? await applicationService.getByUser()
        : await applicationService.getUserApplications();
      // If owner, show recent applications to their listings
      if (user.role === "owner") {
        setRecentApplications(applications.slice(0, 5));
      }
      const agreements = await agreementService.getByUser();

      if (user.role === "renter") {
        const rented = (agreements || []).filter((agreement) =>
          ["confirmed", "active"].includes(
            String(agreement?.status || "").toLowerCase(),
          ),
        );
        setRenterAgreements(rented);
      } else if (user.role === "owner") {
        const owned = (agreements || []).filter(
          (agreement) =>
            String(agreement?.status || "").toLowerCase() !== "cancelled",
        );
        setOwnerAgreements(owned);
      }

      setStats((prev) => ({
        ...prev,
        applications: applications.length,
        agreements: agreements.length,
      }));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteListing = async (id) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      await listingService.delete(id);
      toast.success("Listing deleted successfully");
      fetchDashboardData();
    } catch (error) {
      toast.error("Failed to delete listing");
    }
  };

  const submitWebsiteReview = async () => {
    if (websiteRating < 1 || websiteRating > 5) {
      toast.error("Please select a rating from 1 to 5 stars");
      return;
    }

    if (!websiteComment.trim()) {
      toast.error("Please add a comment");
      return;
    }

    try {
      setSubmittingWebsiteReview(true);
      await websiteReviewService.submit({
        rating: websiteRating,
        comment: websiteComment.trim(),
      });
      toast.success("Thanks for rating the website!");
      setShowWebsiteReviewModal(false);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to submit website rating",
      );
    } finally {
      setSubmittingWebsiteReview(false);
    }
  };

  const handleBrowseFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBrowseFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBrowseFilterSubmit = (e) => {
    e.preventDefault();
    fetchRenterBrowseListings();
  };

  const fetchRenterBrowseListings = async (activeFilters = browseFilters) => {
    if (!user || user.role !== "renter") return;

    setRenterBrowseLoading(true);
    try {
      const requestFilters = {
        ...activeFilters,
        search: "",
      };

      let data = await listingService.getAll(requestFilters);

      const searchText = String(activeFilters.search || "")
        .trim()
        .toLowerCase();

      if (searchText) {
        data = data.filter((listing) => {
          const targetText = [
            listing?.title,
            listing?.description,
            listing?.owner?.fullName,
            listing?.owner?.full_name,
            listing?.owner?.name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return targetText.includes(searchText);
        });
      }

      data = data.filter((listing) => Number(listing?.capacity) > 0);

      setRenterBrowseListings(data);
    } catch (error) {
      console.error("Failed to fetch dashboard renter listings:", error);
      setRenterBrowseListings([]);
    } finally {
      setRenterBrowseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.fullName}!
            </h1>
            <p className="text-gray-600 mt-2">
              {user.role === "owner"
                ? "Manage your listings and applications"
                : "Find your perfect boarding house"}
            </p>
          </div>

          {/* Browse Listings + Totals */}
          <div className="card p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Search Boarding Houses
            </h2>

            {user?.role === "renter" ? (
              <form onSubmit={handleBrowseFilterSubmit} className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="search"
                        value={browseFilters.search}
                        onChange={handleBrowseFilterChange}
                        placeholder="Search by owner/title/description..."
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        name="location"
                        value={browseFilters.location}
                        onChange={handleBrowseFilterChange}
                        placeholder="Location"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <input
                      type="number"
                      name="minPrice"
                      min="0"
                      value={browseFilters.minPrice}
                      onChange={handleBrowseFilterChange}
                      placeholder="Min Price"
                      className="input-field"
                    />
                    <input
                      type="number"
                      name="maxPrice"
                      min="0"
                      value={browseFilters.maxPrice}
                      onChange={handleBrowseFilterChange}
                      placeholder="Max Price"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="verified"
                      id="dashboard-verified"
                      checked={browseFilters.verified}
                      onChange={handleBrowseFilterChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor="dashboard-verified"
                      className="ml-2 text-sm text-gray-700"
                    >
                      Verified listings only
                    </label>
                  </div>

                  <button type="submit" className="btn-primary">
                    <Filter className="inline h-5 w-5 mr-2" />
                    Apply Filters
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-6">
                <Link to="/listings" className="btn-outline">
                  Find Here ...
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-gray-600">
                  {user.role === "owner"
                    ? "My Total Listings"
                    : "Total Applications"}
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {user.role === "owner" ? stats.listings : stats.applications}
                </p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-gray-600">Total Agreements</p>
                <p className="text-2xl font-bold text-green-700">
                  {stats.agreements}
                </p>
              </div>
            </div>

            {user?.role === "renter" && (
              <div className="mt-6">
                {renterBrowseLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                  </div>
                ) : renterBrowseListings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {renterBrowseListings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-gray-600 text-lg">No listing found.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* My Listings (for owners) */}
          {user.role === "owner" && myListings.length > 0 && (
            <div className="card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">My Listings</h2>
                <Link
                  to="/create-listing"
                  className="text-primary-600 hover:text-primary-700"
                >
                  Add New
                </Link>
              </div>
              <div className="space-y-4">
                {myListings.map((listing) => {
                  const listingImages = getListingImages(listing);
                  const listingAmenities = getListingAmenities(listing);
                  const listingCapacity = Number(listing.capacity) || 0;

                  return (
                    <div
                      key={listing.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0">
                          <Link
                            to={`/listings/${listing.id}`}
                            className="w-full sm:w-52 h-36 rounded-lg overflow-hidden bg-gradient-to-r from-primary-400 to-primary-600 flex-shrink-0 block"
                            aria-label={`Open ${listing.title || "listing"} details`}
                          >
                            {listingImages.length > 0 ? (
                              <img
                                src={listingImages[0]}
                                alt={listing.title || "Boarding house image"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Home className="h-10 w-10 text-white/70" />
                              </div>
                            )}
                          </Link>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-gray-900 text-lg line-clamp-1">
                                {listing.title}
                              </h3>
                              {listing.status && (
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                                  {listing.status}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                              <span className="line-clamp-1">
                                {listing.location || "No location provided"}
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                              <p className="text-primary-600 font-semibold">
                                ₱{listing.price}/month
                              </p>
                              <p className="text-sm text-gray-600 inline-flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {listingCapacity} slot
                                {listingCapacity === 1 ? "" : "s"}
                              </p>
                            </div>

                            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                              {listing.description ||
                                "No description added for this boarding house yet."}
                            </p>

                            {listingAmenities.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {listingAmenities
                                  .slice(0, 4)
                                  .map((amenity, index) => (
                                    <span
                                      key={`${listing.id}-amenity-${index}`}
                                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md border border-gray-200"
                                    >
                                      {amenity}
                                    </span>
                                  ))}
                                {listingAmenities.length > 4 && (
                                  <span className="text-xs text-gray-500 px-1 py-1">
                                    +{listingAmenities.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-2 self-end md:self-start">
                          <Link
                            to={`/edit-listing/${listing.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => handleDeleteListing(listing.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Recent Applications
              </h2>
              {user.role === "owner" ? (
                recentApplications.length > 0 ? (
                  <div className="space-y-4">
                    {recentApplications.map((app) => {
                      const applicant = getRelationObject(app.applicant);

                      return (
                        <div key={app.id} className="border rounded p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {app.listing?.title}
                              </p>

                              <div className="mt-2 flex items-center gap-3">
                                {applicant?.profile_picture ? (
                                  <img
                                    src={applicant.profile_picture}
                                    alt={`${applicant?.full_name || "Renter"} avatar`}
                                    className="h-10 w-10 rounded-full object-cover border border-gray-200"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-600 border border-gray-300 flex items-center justify-center text-sm font-semibold">
                                    {applicant?.full_name
                                      ?.charAt(0)
                                      ?.toUpperCase() || "R"}
                                  </div>
                                )}

                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    {applicant?.full_name || "Unknown renter"}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {applicant?.phone || "No phone number"}
                                  </p>
                                </div>
                              </div>

                              <p className="text-xs text-gray-500">
                                {new Date(app.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-700 mb-2">
                                {app.status}
                              </p>
                              {app.status === "pending" && (
                                <div className="space-x-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await applicationService.updateStatus(
                                          app.id,
                                          "accepted",
                                        );
                                        toast.success(
                                          "Application accepted — agreement created",
                                        );
                                        fetchDashboardData();
                                      } catch (err) {
                                        toast.error(
                                          "Failed to accept application",
                                        );
                                      }
                                    }}
                                    className="btn-primary text-sm mr-2"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await applicationService.updateStatus(
                                          app.id,
                                          "rejected",
                                        );
                                        toast.success("Application rejected");
                                        fetchDashboardData();
                                      } catch (err) {
                                        toast.error(
                                          "Failed to reject application",
                                        );
                                      }
                                    }}
                                    className="btn-secondary text-sm"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-gray-600">
                      <Link
                        to="/applications"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all applications →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p>No recent applications yet.</p>
                    <div className="mt-3">
                      <Link
                        to="/applications"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all applications →
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-gray-600">
                  <Link
                    to="/applications"
                    className="text-primary-600 hover:text-primary-700"
                  >
                    View your applications →
                  </Link>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Active Agreements
              </h2>
              {user.role === "renter" ? (
                renterAgreements.length > 0 ? (
                  <div className="space-y-4">
                    {renterAgreements.map((agreement) => {
                      const paymentStatus = getPaymentStatusBadge(agreement);
                      const timeStatus = getTimeStatusBadge(agreement);
                      const listing = agreement.listing;
                      const listingImages = getListingImages(listing);
                      const listingAmenities = getListingAmenities(listing);
                      const listingCapacity = Number(listing?.capacity) || 0;
                      const totalRatings =
                        Number(
                          listing?.totalRatings || listing?.total_ratings,
                        ) || 0;
                      const averageRating =
                        Number(
                          listing?.averageRating ?? listing?.average_rating,
                        ) || 0;
                      const roundedStars = Math.min(
                        5,
                        Math.max(0, Math.floor(averageRating)),
                      );
                      const visualStars = `${"★".repeat(roundedStars)}${"☆".repeat(5 - roundedStars)}`;

                      return (
                        <div
                          key={agreement.id}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex gap-4">
                            {/* Boarding House Image */}
                            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-r from-primary-400 to-primary-600 flex-shrink-0">
                              {listingImages.length > 0 ? (
                                <img
                                  src={listingImages[0]}
                                  alt={listing?.title || "Boarding house"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Home className="h-8 w-8 text-white/70" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                                {listing?.title || "Unknown Boarding House"}
                              </p>
                              <div className="flex items-center text-xs text-gray-600 mt-1">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="line-clamp-1">
                                  {listing?.location || "No location"}
                                </span>
                              </div>

                              {/* Price and Capacity */}
                              <div className="mt-2 flex items-center gap-3 text-xs">
                                <span className="font-semibold text-primary-600">
                                  ₱{listing?.price}/month
                                </span>
                                <span className="text-gray-600 inline-flex items-center">
                                  <Users className="h-3 w-3 mr-1" />
                                  {listingCapacity} slot
                                  {listingCapacity === 1 ? "" : "s"}
                                </span>
                              </div>

                              {/* Rating */}
                              {totalRatings > 0 && (
                                <div className="mt-2 flex items-center text-xs text-gray-600">
                                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                                  <span className="text-yellow-500 mr-1">
                                    {visualStars}
                                  </span>
                                  <span>
                                    {averageRating.toFixed(1)}/5 •{" "}
                                    {totalRatings} rating
                                    {totalRatings !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              )}

                              {/* Amenities */}
                              {listingAmenities.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {listingAmenities
                                    .slice(0, 2)
                                    .map((amenity, index) => (
                                      <span
                                        key={`${agreement.id}-amenity-${index}`}
                                        className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200"
                                      >
                                        {amenity}
                                      </span>
                                    ))}
                                  {listingAmenities.length > 2 && (
                                    <span className="text-xs text-gray-500 px-1 py-0.5">
                                      +{listingAmenities.length - 2} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Status Badges */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${paymentStatus.className}`}
                                >
                                  {paymentStatus.text}
                                </span>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${timeStatus.className}`}
                                >
                                  {timeStatus.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div>
                      <Link
                        to="/agreements"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all agreements →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p>No rented boarding house yet.</p>
                    <div className="mt-3">
                      <Link
                        to="/agreements"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all agreements →
                      </Link>
                    </div>
                  </div>
                )
              ) : user.role === "owner" ? (
                ownerAgreements.length > 0 ? (
                  <div className="space-y-3">
                    {ownerAgreements.map((agreement) => {
                      const paymentStatus = getPaymentStatusBadge(agreement);
                      const timeStatus = getTimeStatusBadge(agreement);
                      const renter = getRelationObject(agreement?.renter);

                      return (
                        <div key={agreement.id} className="border rounded p-3">
                          <p className="font-semibold text-gray-900">
                            {agreement.listing?.title ||
                              "Unknown Boarding House"}
                          </p>
                          <p className="text-xs text-gray-500 mb-2">
                            {agreement.listing?.location || "No location"}
                          </p>

                          <div className="mb-2 flex items-center gap-3">
                            {renter?.profile_picture ? (
                              <img
                                src={renter.profile_picture}
                                alt={`${renter?.full_name || "Renter"} avatar`}
                                className="h-10 w-10 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-600 border border-gray-300 flex items-center justify-center text-sm font-semibold">
                                {renter?.full_name?.charAt(0)?.toUpperCase() ||
                                  "R"}
                              </div>
                            )}

                            <div className="text-sm text-gray-700 space-y-1">
                              <p>
                                Renter: {renter?.full_name || "Unknown renter"}
                              </p>
                              <p>Email: {renter?.email || "No email"}</p>
                              <p>Phone: {renter?.phone || "No phone"}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-300 capitalize">
                              Agreement: {agreement?.status || "pending"}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${paymentStatus.className}`}
                            >
                              {paymentStatus.text}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${timeStatus.className}`}
                            >
                              {timeStatus.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div>
                      <Link
                        to="/agreements"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all agreements →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-600">
                    <p>No active agreements yet for your listings.</p>
                    <div className="mt-3">
                      <Link
                        to="/agreements"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        View all agreements →
                      </Link>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-gray-600">
                  <Link
                    to="/agreements"
                    className="text-primary-600 hover:text-primary-700"
                  >
                    View all agreements →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>

      {showWebsiteReviewModal && ["renter", "owner"].includes(user?.role) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Rate the Website
            </h2>
            <p className="text-gray-600 mb-4">
              Welcome! Please rate your experience with the website. You can
              rate once per account.
            </p>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Rating</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setWebsiteRating(star)}
                    className="transition-transform hover:scale-110"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= websiteRating
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                {websiteRating > 0 && (
                  <span className="text-sm text-gray-600 ml-2">
                    {websiteRating}/5
                  </span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comment
              </label>
              <textarea
                value={websiteComment}
                onChange={(e) => setWebsiteComment(e.target.value)}
                rows={4}
                placeholder="Tell us about your website experience..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWebsiteReviewModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                disabled={submittingWebsiteReview}
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitWebsiteReview}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={submittingWebsiteReview}
              >
                {submittingWebsiteReview ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
