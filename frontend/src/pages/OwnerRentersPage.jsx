import { useState, useEffect } from "react";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";

const OwnerRentersPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({
    start_date: "",
    due_date: "",
  });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const data = await agreementService.getByUser();
      // owners get agreements where they are owner
      setAgreements(data.filter((a) => a.owner_id === user.id));
    } catch (err) {
      console.error("Failed to load agreements", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agreement) => {
    setEditingId(agreement.id);
    setEditValues({
      start_date: agreement.renter_confirmed_at
        ? agreement.renter_confirmed_at.split("T")[0]
        : "",
      due_date: agreement.due_date ? agreement.due_date.split("T")[0] : "",
    });
  };

  const saveEdit = async () => {
    try {
      await agreementService.updateStatus(editingId, editValues);
      toast.success("Dates updated");
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error("Error updating dates", err);
      toast.error("Failed to update dates");
    }
  };

  const cancelAgreement = async (id) => {
    if (!confirm("Remove this renter?")) return;
    try {
      await agreementService.cancel(id, "cancelled by owner");
      toast.success("Renter removed");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove renter");
    }
  };

  const getStatusBadge = (agreement) => {
    if (agreement.rent_status === "paid") {
      return {
        text: "Paid",
        bgColor: "bg-green-100",
        textColor: "text-green-700",
        borderColor: "border-green-300",
      };
    }

    if (agreement.rent_status === "cancelled") {
      return {
        text: "Cancelled",
        bgColor: "bg-gray-100",
        textColor: "text-gray-700",
        borderColor: "border-gray-300",
      };
    }

    if (!agreement.due_date) {
      return {
        text: "No Due Date",
        bgColor: "bg-gray-100",
        textColor: "text-gray-700",
        borderColor: "border-gray-300",
      };
    }

    const dueDate = new Date(agreement.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      // Overdue (red)
      return {
        text: "Overdue",
        bgColor: "bg-red-100",
        textColor: "text-red-700",
        borderColor: "border-red-300",
      };
    } else if (daysUntilDue <= 7) {
      // Within 1 week (orange)
      return {
        text: `Due in ${daysUntilDue} days`,
        bgColor: "bg-orange-100",
        textColor: "text-orange-700",
        borderColor: "border-orange-300",
      };
    } else {
      // More than 1 week (green)
      return {
        text: "On Track",
        bgColor: "bg-green-100",
        textColor: "text-green-700",
        borderColor: "border-green-300",
      };
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
    <div className="min-h-screen bg-gray-50">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Renters</h1>
          <p className="text-gray-600 mt-2">Manage your current renters</p>
        </div>

        {agreements.length > 0 ? (
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2">Renter</th>
                <th className="px-4 py-2">Listing</th>
                <th className="px-4 py-2">Start Date</th>
                <th className="px-4 py-2">Due Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="px-4 py-2">
                    {a.renter?.full_name || "Unknown"}
                  </td>
                  <td className="px-4 py-2">{a.listing?.title || "-"}</td>
                  <td className="px-4 py-2">
                    {editingId === a.id ? (
                      <input
                        type="date"
                        value={editValues.start_date}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            start_date: e.target.value,
                          })
                        }
                        className="input-field"
                      />
                    ) : a.renter_confirmed_at ? (
                      new Date(a.renter_confirmed_at).toLocaleDateString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === a.id ? (
                      <input
                        type="date"
                        value={editValues.due_date}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            due_date: e.target.value,
                          })
                        }
                        className="input-field"
                      />
                    ) : a.due_date ? (
                      new Date(a.due_date).toLocaleDateString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {(() => {
                      const badge = getStatusBadge(a);
                      return (
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold border ${badge.bgColor} ${badge.textColor} ${badge.borderColor}`}
                        >
                          {badge.text}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    {editingId === a.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="btn-primary btn-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-secondary btn-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(a)}
                          className="btn-primary btn-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => cancelAgreement(a.id)}
                          className="text-red-600 btn-sm"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-600">No renters found.</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default OwnerRentersPage;
