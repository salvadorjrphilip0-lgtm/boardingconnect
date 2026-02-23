import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  MapPin,
  Users,
  Home,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  FileText,
} from "lucide-react";
import {
  listingService,
  agreementService,
  messageService,
  applicationService,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";

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

  useEffect(() => {
    fetchListingDetails();
    checkIfApplied();
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

  const handleUpdateRentStatus = async (agreementId, rentStatus) => {
    try {
      await agreementService.updateStatus(agreementId, {
        rent_status: rentStatus,
      });
      toast.success("Rent status updated");
      fetchListingAgreements();
    } catch (err) {
      toast.error("Failed to update rent status");
    }
  };

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

  const handleContactOwner = () => {
    if (!user) {
      toast.error("Please login to contact owner");
      navigate("/login");
      return;
    }
    navigate("/messages", { state: { recipientId: listing.ownerId } });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
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
                    <span>{listing.location}</span>
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

                {/* Only show message button if user is not the owner */}
                {!user || user.id !== listing.ownerId ? (
                  <button
                    onClick={handleContactOwner}
                    disabled={!user}
                    className="w-full btn-outline"
                  >
                    <MessageSquare className="inline h-5 w-5 mr-2" />
                    Message Owner
                  </button>
                ) : null}
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
                                  Rent Status
                                </p>
                                <p className="font-semibold text-gray-900 capitalize">
                                  {agr.rent_status}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() =>
                                  handleUpdateRentStatus(agr.id, "paid")
                                }
                                className="btn-primary btn-sm"
                              >
                                Mark Paid
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateRentStatus(agr.id, "due")
                                }
                                className="btn-secondary btn-sm"
                              >
                                Due
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateRentStatus(agr.id, "cancelled")
                                }
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Cancel
                              </button>
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
    </div>
  );
};

export default ListingDetailsPage;
