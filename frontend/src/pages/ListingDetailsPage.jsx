import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  Users,
  Home,
  Phone,
  Mail,
  CheckCircle,
  FileText,
} from "lucide-react";
import {
  listingService,
  agreementService,
  applicationService,
  reviewService,
  ownerReviewService,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import { getRenterStatusBadge } from "../utils/renterStatus";

const ListingDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [renters, setRenters] = useState([]);
  const [loadingRenters, setLoadingRenters] = useState(false);

  // new state for agreements belonging to this listing (owner view)
  const [listingAgreements, setListingAgreements] = useState([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsSummary, setReviewsSummary] = useState({
    average: 0,
    total: 0,
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [showOwnerProfile, setShowOwnerProfile] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!selectedReviewer) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedReviewer(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReviewer]);

  useEffect(() => {
    fetchListingDetails();
    checkIfApplied();
    fetchListingReviews();
  }, [id, user]);

  useEffect(() => {
    // Fetch renters and agreements if user is the owner
    if (listing && user && user.id === listing.ownerId) {
      fetchRenters();
      fetchListingAgreements();
    }
  }, [listing, user]);

  const checkIfApplied = async () => {
    if (!user || user.role !== "renter") {
      setHasApplied(false);
      return;
    }
    try {
      const agreements = await agreementService.getByUser();
      const alreadyApplied = agreements.some(
        (a) => a.listing_id === id || a.listing?.id === id,
      );
      setHasApplied(alreadyApplied);
    } catch (error) {
      console.error("Failed to check applications:", error);
      setHasApplied(false);
    }
  };

  const fetchRenters = async () => {
    try {
      setLoadingRenters(true);
      const rentersData = await applicationService.getRentersByListing(id);
      setRenters(rentersData);
    } catch (error) {
      console.error("Failed to fetch renters:", error);
      // Don't show error toast, just silently fail
    } finally {
      setLoadingRenters(false);
    }
  };

  const fetchListingAgreements = async () => {
    try {
      setLoadingAgreements(true);
      const agreementsData = await agreementService.getByListing(id);
      setListingAgreements(agreementsData);
    } catch (error) {
      console.error("Failed to fetch listing agreements:", error);
    } finally {
      setLoadingAgreements(false);
    }
  };

  const fetchListingDetails = async () => {
    try {
      const data = await listingService.getById(id);
      // If the server hasn't returned images yet (or they are empty), use
      // any previews passed in navigation state so the user sees their
      // uploaded images immediately after posting.
      if (
        (!data.images || data.images.length === 0) &&
        location.state?.previews
      ) {
        data.images = location.state.previews;
      }
      setListing(data);
    } catch (error) {
      console.error("Failed to fetch listing:", error);
      toast.error("Listing not found");
    } finally {
      setLoading(false);
    }
  };

  const fetchListingReviews = async () => {
    try {
      setLoadingReviews(true);
      const data = await reviewService.getByListing(id);
      const listingReviews = data?.reviews || [];
      setReviews(listingReviews);
      setReviewsSummary({
        average: data?.average_rating || 0,
        total: data?.total_reviews || listingReviews.length,
      });
    } catch (error) {
      console.error("Failed to fetch listing reviews:", error);
      setReviews([]);
      setReviewsSummary({ average: 0, total: 0 });
    } finally {
      setLoadingReviews(false);
    }
  };

  const getRenterStatus = (agreement) => getRenterStatusBadge(agreement);

  const handleApproveApplication = async (applicationId) => {
    try {
      await applicationService.updateStatus(applicationId, "accepted");
      toast.success("Application approved!");
      fetchRenters();
      fetchListingAgreements();
    } catch (err) {
      toast.error("Failed to approve application");
    }
  };

  const handleRejectApplication = async (applicationId) => {
    try {
      await applicationService.updateStatus(applicationId, "rejected");
      toast.success("Application rejected");
      fetchRenters();
    } catch (err) {
      toast.error("Failed to reject application");
    }
  };

  const handleApply = async () => {
    if (!user) {
      toast.error("Please login to apply");
      navigate("/login");
      return;
    }

    if (user.role !== "renter") {
      toast.error("Only renters can apply to listings");
      return;
    }

    if (listing.status && listing.status !== "approved") {
      if (listing.status === "rejected") {
        toast.error(
          "This listing was rejected by admin and cannot be applied to.",
        );
      } else {
        toast.error(
          "This listing is pending admin approval and cannot be applied to yet.",
        );
      }
      return;
    }

    setApplying(true);
    try {
      await agreementService.create({ listingId: listing.id });
      toast.success("Agreement request submitted successfully!");
      setHasApplied(true);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to request agreement",
      );
    } finally {
      setApplying(false);
    }
  };

  const handleSubmitOwnerReview = async () => {
    if (!user || user.role !== "renter") {
      toast.error("Only renters can submit a review");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating from 1 to 5 stars");
      return;
    }

    setSubmittingReview(true);
    try {
      const ownerId = listing.ownerId || listing.owner?.id;
      if (!ownerId) {
        toast.error("Owner information is not available for review");
        setSubmittingReview(false);
        return;
      }

      await ownerReviewService.create({
        owner_id: ownerId,
        listing_id: listing.id,
        rating: reviewRating,
        comment: reviewComment?.trim() || null,
      });

      toast.success("Review submitted successfully!");
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
      fetchListingReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Listing not found</p>
      </div>
    );
  }

  const normalizedLocation = (listing.location || "").trim();
  const mapQueryUrl = normalizedLocation
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedLocation)}`
    : "";
  const mapEmbedUrl = normalizedLocation
    ? `https://www.google.com/maps?q=${encodeURIComponent(normalizedLocation)}&output=embed`
    : "";

  return (
    <div className="min-h-screen bg-gray-50">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            {/* Images */}
            <div className="card overflow-hidden mb-6">
              <div className="h-96 bg-gradient-to-r from-primary-400 to-primary-600">
                {listing.images && listing.images.length > 0 ? (
                  <img
                    src={listing.images[0]}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Home className="h-32 w-32 text-white opacity-50" />
                  </div>
                )}
              </div>
              {/* Image Gallery Thumbnails */}
              {listing.images && listing.images.length > 1 && (
                <div className="bg-white p-3 border-t border-gray-200 flex gap-2 overflow-x-auto">
                  {listing.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`Listing view ${index + 1}`}
                      className="h-20 w-20 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                      onClick={() => {
                        const mainImage = document.querySelector(
                          '[alt="' + listing.title + '"]',
                        );
                        if (mainImage) mainImage.src = image;
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="card p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {listing.title}
                  </h1>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-5 w-5 mr-1" />
                    <button
                      type="button"
                      onClick={() => setShowLocationMap((prev) => !prev)}
                      className="text-left text-primary-700 hover:text-primary-900 underline"
                    >
                      {listing.location}
                    </button>
                    {mapQueryUrl && (
                      <a
                        href={mapQueryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        Open map
                      </a>
                    )}
                  </div>
                </div>
                {listing.status === "approved" || listing.verified ? (
                  <div className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-semibold">Verified</span>
                  </div>
                ) : listing.status === "rejected" ? (
                  <div className="flex items-center bg-red-100 text-red-800 px-3 py-1 rounded-full">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-semibold">Rejected</span>
                  </div>
                ) : (
                  <div className="flex items-center bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm font-semibold">Pending</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-6 mb-6 pb-6 border-b">
                <div className="flex items-center text-primary-600">
                  <span className="inline-flex items-center justify-center text-primary-600 mr-2 text-2xl">
                    ₱
                  </span>
                  <span className="text-2xl font-bold">{listing.price}</span>
                  <span className="text-gray-500 ml-1">/month</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Users className="h-5 w-5 mr-1" />
                  <span>
                    {listing.capacity === 0
                      ? "No Slot Remaining"
                      : `${listing.capacity} available slot${listing.capacity !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">
                  Description
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {listing.description}
                </p>
              </div>

              {showLocationMap && mapEmbedUrl && (
                <div className="mt-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    Location Map
                  </h2>
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      title="Boarding house location map"
                      src={mapEmbedUrl}
                      className="w-full h-80"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              )}

              {listing.amenities && listing.amenities.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    Amenities
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {listing.amenities.map((amenity, index) => (
                      <div
                        key={index}
                        className="flex items-center text-gray-700"
                      >
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold text-gray-900">Reviews</h2>
                  <div className="text-sm text-gray-600">
                    {reviewsSummary.total > 0
                      ? `${reviewsSummary.average}/5 (${reviewsSummary.total} review${reviewsSummary.total > 1 ? "s" : ""})`
                      : "No ratings yet"}
                  </div>
                </div>

                {loadingReviews ? (
                  <div className="py-4 text-center text-gray-600">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-gray-600 text-sm">
                    No reviews yet. Reviews from renters will appear here.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-lg border border-gray-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            {review.users?.profile_picture ? (
                              <img
                                src={review.users.profile_picture}
                                alt={`${review.users?.full_name || "Renter"} profile`}
                                className="h-9 w-9 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-semibold">
                                {(review.users?.full_name || "R")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReviewer({
                                  fullName: review.users?.full_name || "Renter",
                                  profilePicture:
                                    review.users?.profile_picture || null,
                                })
                              }
                              className="font-semibold text-gray-900 hover:text-primary-700 underline"
                            >
                              {review.users?.full_name || "Renter"}
                            </button>
                          </div>
                          <p className="text-sm text-yellow-600 font-semibold">
                            {"⭐".repeat(review.rating)} ({review.rating}/5)
                          </p>
                        </div>
                        {review.comment ? (
                          <p className="text-sm text-gray-700 whitespace-pre-line">
                            {review.comment}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">No comment</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="card p-6 sticky top-20">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Contact Owner
              </h3>

              {listing.owner && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Owner Information
                  </h4>
                  <div className="flex items-center space-x-4 mb-4">
                    {listing.owner.profilePicture ? (
                      <img
                        src={listing.owner.profilePicture}
                        alt={`${listing.owner.fullName}'s profile`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
                        <Users className="h-8 w-8 text-gray-600" />
                      </div>
                    )}
                    <div>
                      <h5 className="text-lg font-medium text-gray-900">
                        {listing.owner.fullName}
                      </h5>
                      <p className="text-sm text-gray-600">Property Owner</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center text-gray-700">
                      <Mail className="h-5 w-5 mr-3 text-gray-400" />
                      <span className="text-sm">{listing.owner.email}</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <Phone className="h-5 w-5 mr-3 text-gray-400" />
                      <span className="text-sm">{listing.owner.phone}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOwnerProfile(true);
                      setShowReviewForm(false);
                    }}
                    className="w-full mt-4 py-2 px-4 rounded font-semibold border border-primary-300 text-primary-700 hover:bg-primary-50 transition-colors"
                  >
                    Profile
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {/* Show Apply Now button only for renters viewing other listings */}
                {user &&
                  user.id !== listing.ownerId &&
                  user.role === "renter" && (
                    <button
                      onClick={handleApply}
                      disabled={
                        applying ||
                        hasApplied ||
                        listing.capacity === 0 ||
                        (listing.status &&
                          listing.status !== "approved" &&
                          !listing.verified)
                      }
                      className={`w-full py-2 px-4 rounded font-semibold transition-colors ${
                        hasApplied
                          ? "bg-green-100 text-green-800 cursor-not-allowed"
                          : "btn-primary disabled:opacity-50"
                      }`}
                    >
                      {listing.capacity === 0
                        ? "Slot Full"
                        : listing.status &&
                            listing.status !== "approved" &&
                            !listing.verified
                          ? listing.status === "rejected"
                            ? "Rejected"
                            : "Pending Approval"
                          : hasApplied
                            ? "✓ Already Applied"
                            : applying
                              ? "Applying..."
                              : "Apply Now"}
                    </button>
                  )}

                {/* Show status button for owners */}
                {user && user.id === listing.ownerId && (
                  <button
                    disabled
                    className={`w-full py-2 px-4 rounded font-semibold transition-colors text-white cursor-not-allowed ${
                      listing.status === "approved" || listing.verified
                        ? "bg-green-600"
                        : listing.status === "rejected"
                          ? "bg-red-600"
                          : "bg-yellow-600"
                    }`}
                  >
                    {listing.status === "approved" || listing.verified
                      ? "Posted"
                      : listing.status === "rejected"
                        ? "Cancelled"
                        : "Pending"}
                  </button>
                )}

                {/* Show Apply Now button for non-logged-in renters viewing other listings */}
                {!user && (
                  <button
                    disabled
                    className="w-full py-2 px-4 rounded font-semibold transition-colors btn-primary disabled:opacity-50"
                  >
                    Apply Now
                  </button>
                )}
              </div>

              {/* Show renters list if user is the owner */}
              {user && user.id === listing.ownerId && (
                <>
                  {/* Pending Applications - Need Action */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Pending Applications
                    </h4>
                    {loadingRenters ? (
                      <div className="py-4 text-center text-gray-600">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      </div>
                    ) : renters.filter((r) => r.applicationStatus === "pending")
                        .length === 0 ? (
                      <p className="text-gray-600 text-sm">
                        No pending applications
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {renters
                          .filter((r) => r.applicationStatus === "pending")
                          .map((renter) => (
                            <div
                              key={renter.id}
                              className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 hover:border-yellow-300 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                  {renter.profile_picture ? (
                                    <img
                                      src={renter.profile_picture}
                                      alt={renter.full_name}
                                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                      <Users className="h-5 w-5 text-gray-600" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-gray-900">
                                      {renter.full_name || "Unknown Applicant"}
                                    </h5>
                                    <p className="text-xs text-gray-600 truncate">
                                      {renter.email || "No email provided"}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      Phone: {renter.phone || "N/A"}
                                    </p>
                                  </div>
                                </div>
                                {renter.verified && (
                                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                                )}
                              </div>
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() =>
                                    handleApproveApplication(
                                      renter.applicationId,
                                    )
                                  }
                                  className="btn-primary btn-sm"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectApplication(
                                      renter.applicationId,
                                    )
                                  }
                                  className="text-red-600 hover:bg-red-50 border border-red-300 rounded px-3 py-1 text-sm"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Accepted/Rejected History */}
                  {renters.filter((r) => r.applicationStatus !== "pending")
                    .length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Application History
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {renters
                          .filter((r) => r.applicationStatus !== "pending")
                          .map((renter) => (
                            <div
                              key={renter.id}
                              className={`rounded-lg p-3 border ${
                                renter.applicationStatus === "accepted"
                                  ? "bg-green-50 border-green-200"
                                  : "bg-red-50 border-red-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {renter.full_name}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    {renter.email}
                                  </p>
                                </div>
                                <span
                                  className={`text-sm font-semibold capitalize ${
                                    renter.applicationStatus === "accepted"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {renter.applicationStatus}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Agreements section for owner */}
                  <div className="mt-8 pt-6 border-t">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Rental Agreements
                    </h4>
                    {loadingAgreements ? (
                      <div className="py-4 text-center text-gray-600">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      </div>
                    ) : listingAgreements.length === 0 ? (
                      <p className="text-gray-600 text-sm">No agreements yet</p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {listingAgreements.map((agr) => (
                          <div
                            key={agr.id}
                            className="bg-white rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <p className="text-sm text-gray-600">Renter</p>
                                <p className="font-semibold text-gray-900">
                                  {agr.renter?.full_name || "Unknown"}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">
                                  Renter Status
                                </p>
                                {(() => {
                                  const status = getRenterStatus(agr);
                                  return (
                                    <span
                                      className={`inline-flex mt-1 items-center px-3 py-1 rounded-full text-sm font-semibold border ${status.color}`}
                                    >
                                      {status.text}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {!user && (
                <p className="text-sm text-gray-600 mt-4 text-center">
                  Please login to apply or contact the owner
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {selectedReviewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSelectedReviewer(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reviewer Profile
            </h3>

            <div className="flex items-center gap-4">
              {selectedReviewer.profilePicture ? (
                <img
                  src={selectedReviewer.profilePicture}
                  alt={`${selectedReviewer.fullName} profile`}
                  className="h-16 w-16 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-700 font-semibold">
                  {selectedReviewer.fullName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold text-gray-900">
                  {selectedReviewer.fullName}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReviewer(null)}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showOwnerProfile && listing?.owner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowOwnerProfile(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Owner Profile
            </h3>

            <div className="flex flex-col items-center text-center gap-3">
              {listing.owner.profilePicture || listing.owner.profile_picture ? (
                <img
                  src={
                    listing.owner.profilePicture ||
                    listing.owner.profile_picture
                  }
                  alt={`${listing.owner.fullName || listing.owner.full_name || "Owner"} profile`}
                  className="h-40 w-40 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-40 w-40 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-700 font-semibold">
                  {(listing.owner.fullName || listing.owner.full_name || "O")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold text-gray-900">
                  {listing.owner.fullName || listing.owner.full_name || "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-10 space-y-2">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">
                  {listing.owner.email || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Number</p>
                <p className="font-medium text-gray-900">
                  {listing.owner.phone || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Title of Boarding House</p>
                <p className="font-medium text-gray-900">
                  {listing.title || "N/A"}
                </p>
              </div>
            </div>

            {showReviewForm && hasApplied && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  Rate Owner
                </p>

                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl leading-none transition-colors ${
                        star <= reviewRating
                          ? "text-yellow-500"
                          : "text-gray-300 hover:text-yellow-400"
                      }`}
                      aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <label className="block text-sm text-gray-700 mb-1">
                  Comment
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="Write your comment..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                  <p className="mt-1 text-xs text-gray-500">
                       You can review once you’ve applied for this listing.
                  </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitOwnerReview}
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              {user &&
                user.role === "renter" &&
                user.id !== listing.ownerId &&
                hasApplied && (
                  <div className="flex flex-col items-end">
                    <button
                      type="button"
                      onClick={() => setShowReviewForm((prev) => !prev)}
                      className="px-4 py-2 rounded-lg border border-primary-300 text-primary-700 hover:bg-primary-50"
                    >
                      {showReviewForm ? "Cancel Review" : "Review"}
                    </button>
                  </div>
                )}
              <button
                type="button"
                onClick={() => setShowOwnerProfile(false)}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingDetailsPage;
