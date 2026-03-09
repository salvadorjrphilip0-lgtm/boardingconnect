import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
} from "lucide-react";
import { agreementService, reviewService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import {
  getPaymentStatusBadge,
  getTimeStatusBadge,
} from "../utils/renterStatus";

const AgreementsPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAgreement, setReviewAgreement] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedListingIds, setReviewedListingIds] = useState([]);

  useEffect(() => {
    if (!user) {
      setAgreements([]);
      setLoading(false);
      return;
    }

    fetchAgreements();
    // refetch when authenticated user changes (role/login)
  }, [user]);

  const fetchAgreements = async () => {
    try {
      const dataRaw = await agreementService.getByUser();
      let data = dataRaw || [];

      // Renters should not see agreements that are still waiting for owner confirmation
      // i.e. agreements with status 'pending' or 'pending_owner'. They should see
      // agreements that require renter action (e.g. owner already confirmed) or
      // confirmed/active/cancelled ones.
      if (user?.role === "renter") {
        data = data.filter(
          (a) => !["pending", "pending_owner"].includes(a.status),
        );

        const listingIds = Array.from(
          new Set(
            data.map((agreement) => agreement?.listing?.id).filter(Boolean),
          ),
        );

        const reviewFlags = await Promise.all(
          listingIds.map(async (listingId) => {
            try {
              const reviewData = await reviewService.getByListing(listingId);
              const alreadyReviewed = (reviewData?.reviews || []).some(
                (review) => review.renter_id === user.id,
              );
              return alreadyReviewed ? listingId : null;
            } catch {
              return null;
            }
          }),
        );

        setReviewedListingIds(reviewFlags.filter(Boolean));
      } else {
        setReviewedListingIds([]);
      }

      setAgreements(data);
    } catch (error) {
      console.error("Failed to fetch agreements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    if (!confirm("Are you sure you want to confirm this agreement?")) return;

    try {
      const currentAgreement = agreements.find(
        (agreement) => agreement.id === id,
      );

      if (user?.role === "owner") {
        await agreementService.confirmByOwner(id);
        toast.success("Agreement owner confirmation recorded");
      } else if (user?.role === "renter") {
        await agreementService.confirmByRenter(id);
        toast.success("Agreement renter confirmation recorded");

        if (currentAgreement?.listing?.id) {
          setReviewAgreement(currentAgreement);
          setReviewRating(0);
          setReviewComment("");
          setShowReviewModal(true);
        }
      } else {
        // fallback generic confirm
        await agreementService.confirm(id);
        toast.success("Agreement confirmed");
      }

      fetchAgreements();
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm agreement");
    }
  };

  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewAgreement(null);
    setReviewRating(0);
    setReviewComment("");
  };

  const openReviewModalForAgreement = (agreement) => {
    if (!agreement?.listing?.id) {
      toast.error("Missing listing details for review");
      return;
    }
    setReviewAgreement(agreement);
    setReviewRating(0);
    setReviewComment("");
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!reviewAgreement?.listing?.id) {
      toast.error("Missing listing details for review");
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      toast.error("Please select a rating from 1 to 5 stars");
      return;
    }

    if (!reviewComment.trim()) {
      toast.error("Please add a comment about your agreement experience");
      return;
    }

    try {
      setSubmittingReview(true);
      await reviewService.create({
        listing_id: reviewAgreement.listing.id,
        rating: reviewRating,
        title: "Agreement & Boarding House Review",
        comment: reviewComment.trim(),
      });

      toast.success("Thanks! Your review has been posted.");
      setReviewedListingIds((prev) =>
        prev.includes(reviewAgreement.listing.id)
          ? prev
          : [...prev, reviewAgreement.listing.id],
      );
      closeReviewModal();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleCancel = async (id) => {
    const reason = prompt("Please provide a reason for cancellation:");
    if (!reason) return;

    try {
      await agreementService.cancel(id, reason);
      toast.success("Agreement cancelled successfully");
      fetchAgreements();
    } catch (error) {
      toast.error("Failed to cancel agreement");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        icon: AlertCircle,
        color: "bg-yellow-100 text-yellow-800",
        text: "Pending",
      },
      confirmed: {
        icon: CheckCircle,
        color: "bg-green-100 text-green-800",
        text: "Confirmed",
      },
      cancelled: {
        icon: XCircle,
        color: "bg-red-100 text-red-800",
        text: "Cancelled",
      },
      active: {
        icon: CheckCircle,
        color: "bg-blue-100 text-blue-800",
        text: "Active",
      },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}
      >
        <Icon className="h-4 w-4 mr-1" />
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agreements</h1>
          <p className="text-gray-600 mt-2">
            Manage your boarding house agreements and confirmations
          </p>
        </div>

        {agreements.length > 0 ? (
          <div className="space-y-4">
            {agreements.map((agreement) => (
              <div key={agreement.id} className="card p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {agreement.listing?.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {agreement.listing?.location}
                    </p>
                    <p className="text-primary-600 font-semibold mt-2">
                      ₱{agreement.listing?.price}/month
                    </p>
                  </div>
                  {getStatusBadge(agreement.status)}
                </div>

                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">
                        {user.role === "owner" ? "Renter" : "Owner"}
                      </p>
                      <p className="font-semibold text-gray-900">
                        Name:{" "}
                        {user.role === "owner"
                          ? agreement.renter?.full_name || "Unknown"
                          : agreement.owner?.full_name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Email:{" "}
                        {user.role === "owner"
                          ? agreement.renter?.email || "No email"
                          : agreement.owner?.email || "No email"}
                      </p>
                      {user.role === "owner" && agreement.renter?.phone && (
                        <p className="text-xs text-gray-600">
                          Phone: {agreement.renter.phone}
                        </p>
                      )}
                      {user.role === "renter" && agreement.owner?.phone && (
                        <p className="text-xs text-gray-600">
                          Phone: {agreement.owner.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Agreement Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(agreement.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {agreement.terms && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">
                      Terms & Conditions
                    </h4>
                    <p className="text-gray-700 text-sm">
                      Renter must follow boarding house rules, pay rent on time,
                      maintain cleanliness, respect owners and co-renters, avoid
                      prohibited activities, and be responsible for damages.
                      Management may terminate occupancy if rules are violated.
                    </p>
                  </div>
                )}

                {/* Renter status visible for both owner and renter views */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Renter Status</p>
                  {(() => {
                    const paymentStatus = getPaymentStatusBadge(agreement);
                    const timeStatus = getTimeStatusBadge(agreement);
                    return (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${paymentStatus.color}`}
                        >
                          {paymentStatus.text}
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${timeStatus.color}`}
                        >
                          {timeStatus.text}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">
                    Created:{" "}
                    {new Date(agreement.created_at).toLocaleDateString()}
                  </p>

                  {/* Actions vary depending on role and confirmation timestamps/status */}
                  {user?.role === "owner" &&
                    !agreement.owner_confirmed_at &&
                    ["pending", "pending_owner"].includes(agreement.status) && (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleConfirm(agreement.id)}
                          className="btn-primary text-sm"
                        >
                          Confirm Agreement
                        </button>
                        <button
                          onClick={() => handleCancel(agreement.id)}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                  {user?.role === "renter" &&
                    agreement.owner_confirmed_at &&
                    !agreement.renter_confirmed_at && (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleConfirm(agreement.id)}
                          className="btn-primary text-sm"
                        >
                          Confirm Agreement
                        </button>
                        <button
                          onClick={() => handleCancel(agreement.id)}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                  {user?.role === "renter" &&
                    ["confirmed", "active"].includes(agreement.status) && (
                      <div className="space-x-2">
                        {reviewedListingIds.includes(agreement.listing?.id) ? (
                          <button
                            disabled
                            className="px-3 py-2 rounded-md text-sm bg-green-100 text-green-700 cursor-not-allowed"
                          >
                            Reviewed
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              openReviewModalForAgreement(agreement)
                            }
                            className="px-3 py-2 rounded-md text-sm bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          >
                            Submit Review
                          </button>
                        )}
                      </div>
                    )}

                  {agreement.status === "confirmed" && (
                    <button
                      onClick={() => handleCancel(agreement.id)}
                      className="btn-secondary text-sm"
                    >
                      Cancel Agreement
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Agreements Yet
            </h3>
            <p className="text-gray-600">
              Your agreements will appear here once applications are accepted
            </p>
          </div>
        )}
      </div>

      <Footer />

      {showReviewModal && reviewAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Rate Your Agreement
            </h2>
            <p className="text-gray-600 mb-4">
              You confirmed your agreement with{" "}
              {reviewAgreement.owner?.full_name || "the owner"}. Share your
              rating and comment for{" "}
              {reviewAgreement.listing?.title || "this boarding house"}.
            </p>

            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Rating</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="transition-transform hover:scale-110"
                    aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= reviewRating
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
                {reviewRating > 0 && (
                  <span className="text-sm text-gray-600 ml-2">
                    {reviewRating}/5
                  </span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comment about the agreement and boarding house
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                placeholder="Share your experience..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                disabled={submittingReview}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitReview}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                disabled={submittingReview}
              >
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgreementsPage;
