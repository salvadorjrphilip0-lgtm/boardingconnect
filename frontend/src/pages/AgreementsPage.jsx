import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sidebar,
} from "lucide-react";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";

const AgreementsPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);

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
      if (user?.role === "owner") {
        await agreementService.confirmByOwner(id);
        toast.success("Agreement owner confirmation recorded");
      } else if (user?.role === "renter") {
        await agreementService.confirmByRenter(id);
        toast.success("Agreement renter confirmation recorded");
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

  const handleRentUpdate = async (id, status) => {
    try {
      await agreementService.updateStatus(id, { rent_status: status });
      toast.success("Rent status updated");
      fetchAgreements();
    } catch (err) {
      toast.error("Failed to update rent status");
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
                    <p className="text-gray-700 text-sm">{agreement.terms}</p>
                  </div>
                )}

                {/* Rent status display and actions for owner */}
                {user.role === "owner" && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">Rent Status</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {agreement.rent_status || "due"}
                    </p>
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => handleRentUpdate(agreement.id, "paid")}
                        className="btn-primary btn-sm"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => handleRentUpdate(agreement.id, "due")}
                        className="btn-secondary btn-sm"
                      >
                        Due
                      </button>
                      <button
                        onClick={() =>
                          handleRentUpdate(agreement.id, "cancelled")
                        }
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Cancel Rent
                      </button>
                    </div>
                  </div>
                )}

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
    </div>
  );
};

export default AgreementsPage;
