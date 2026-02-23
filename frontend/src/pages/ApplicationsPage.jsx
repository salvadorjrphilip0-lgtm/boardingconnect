import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
} from "lucide-react";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import OwnerSidebar from "../components/OwnerSidebar";
import RenterSidebar from "../components/RenterSidebar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";

const ApplicationsPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImageSrc, setModalImageSrc] = useState(null);
  const [modalImageAlt, setModalImageAlt] = useState("");
  const [modalImageList, setModalImageList] = useState([]);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  useEffect(() => {
    if (!user) {
      setAgreements([]);
      setLoading(false);
      return;
    }
    fetchAgreements();
  }, [user]);

  const fetchAgreements = async () => {
    try {
      const data = await agreementService.getByUser();
      setAgreements(data || []);
    } catch (error) {
      console.error("Failed to fetch agreements:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    try {
      await agreementService.confirm(id);
      toast.success(`Agreement confirmed`);
      fetchAgreements();
    } catch (error) {
      toast.error("Failed to confirm agreement");
    }
  };

  const handleCancel = async (id) => {
    try {
      await agreementService.cancel(id, "cancelled by owner");
      toast.success(`Agreement cancelled`);
      fetchAgreements();
    } catch (error) {
      toast.error("Failed to cancel agreement");
    }
  };

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
  }, [imageModalOpen, modalImageIndex, modalImageList]);

  const openImageModal = (listOrSrc, index = 0, altPrefix = "") => {
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: {
        icon: Clock,
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
        color: "bg-green-100 text-green-800",
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
    <div className="min-h-screen bg-gray-50 flex">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Application</h1>
            <p className="text-gray-600 mt-2">
              {user.role === "owner"
                ? "Manage application requests to your listings"
                : "Track your boarding house application requests"}
            </p>
          </div>

          {agreements.length > 0 ? (
            <div className="space-y-6">
              {agreements.map((app) => (
                <div key={app.id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {app.listing?.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {app.listing?.location}
                      </p>

                      {user.role === "owner" && app.renter && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                            <User className="h-5 w-5 mr-2" />
                            Renter Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center">
                              <User className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="text-sm">
                                <span className="font-medium">Name:</span>{" "}
                                {app.renter.full_name}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="text-sm">
                                <span className="font-medium">Email:</span>{" "}
                                {app.renter.email}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="text-sm">
                                <span className="font-medium">Phone:</span>{" "}
                                {app.renter.phone}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <Shield className="h-4 w-4 text-gray-500 mr-2" />
                              <span className="text-sm">
                                <span className="font-medium">Verified:</span>{" "}
                                <span
                                  className={
                                    app.renter.verified
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {app.renter.verified ? "Yes" : "No"}
                                </span>
                              </span>
                            </div>
                          </div>

                          {app.renter.profile_picture && (
                            <div className="mt-3">
                              <img
                                src={app.renter.profile_picture}
                                alt={`${app.renter.full_name}'s profile`}
                                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {user.role === "renter" && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                            <FileText className="h-5 w-5 mr-2" />
                            Boarding House Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Owner</p>
                              <p className="font-semibold text-gray-900">
                                {app.owner?.full_name ||
                                  app.owner?.fullName ||
                                  "Unknown"}
                              </p>
                              <p className="text-sm text-gray-600 mt-2">
                                Price: ₱{app.listing?.price}/month
                              </p>
                              <p className="text-sm text-gray-600">
                                Capacity: {app.listing?.capacity}
                              </p>
                              {app.owner?.email && (
                                <div className="flex items-center text-sm text-gray-600 mt-2">
                                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                                  <span>{app.owner.email}</span>
                                </div>
                              )}
                              {app.owner?.phone && (
                                <div className="flex items-center text-sm text-gray-600 mt-1">
                                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                                  <span>{app.owner.phone}</span>
                                </div>
                              )}
                              {app.listing?.amenities &&
                                app.listing.amenities.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-sm text-gray-600 mb-2">
                                      Amenities
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {app.listing.amenities.map((a, i) => (
                                        <span
                                          key={i}
                                          className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700"
                                        >
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                            <div>
                              {app.listing?.images &&
                              app.listing.images.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {app.listing.images.map((img, i, arr) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() =>
                                        openImageModal(
                                          arr,
                                          i,
                                          `${app.listing?.title}`,
                                        )
                                      }
                                      className="block overflow-hidden rounded"
                                    >
                                      <img
                                        src={img}
                                        alt={`${app.listing.title} - ${i + 1}`}
                                        className="w-full h-24 md:h-28 object-cover rounded"
                                      />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                                  No Image
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {getStatusBadge(app.status)}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      Created:{" "}
                      {new Date(app.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    {user.role === "owner" && app.status === "pending" && (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleConfirm(app.id)}
                          className="btn-primary text-sm"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleCancel(app.id)}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {user.role === "renter" && app.status === "pending" && (
                      <div className="text-sm text-gray-500">
                        Your agreement request is pending owner confirmation.
                      </div>
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
                {user.role === "owner"
                  ? "Agreement requests to your listings will appear here"
                  : "Request agreements on listings to see them here"}
              </p>
            </div>
          )}
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

                {modalImageList && modalImageList.length > 1 && (
                  <button
                    onClick={goPrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                )}

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
      </div>
    </div>
  );
};

export default ApplicationsPage;
