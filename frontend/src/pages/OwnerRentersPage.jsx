import { useState, useEffect } from "react";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import {
  getPaymentStatusBadge,
  getPaymentAmountFromAgreement,
  parseAgreementTerms,
  getRentCycleDay,
  getTimeStatusBadge,
} from "../utils/renterStatus";

const OwnerRentersPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({
    start_date: "",
    due_date: "",
    contract_date: "",
    payment_amount: "",
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
      contract_date: agreement.end_date ? agreement.end_date.split("T")[0] : "",
      payment_amount: String(getPaymentAmountFromAgreement(agreement) || ""),
    });
  };

  const saveEdit = async () => {
    try {
      const payload = {
        start_date: editValues.start_date || null,
        due_date: editValues.due_date || null,
        contract_date: editValues.contract_date || null,
      };

      if (
        editValues.payment_amount !== "" &&
        editValues.payment_amount !== null &&
        editValues.payment_amount !== undefined
      ) {
        payload.payment_amount = Number(editValues.payment_amount);
      }

      await agreementService.updateStatus(editingId, payload);
      toast.success("Renter details updated");
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error("Error updating renter details", err);
      toast.error(err?.response?.data?.message || "Failed to update details");
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

  const buildAgreementWithPaymentOverride = (
    agreement,
    paymentAmountOverride,
  ) => {
    const parsedOverride = Number(paymentAmountOverride);
    const hasOverride =
      paymentAmountOverride !== undefined &&
      paymentAmountOverride !== null &&
      paymentAmountOverride !== "" &&
      Number.isFinite(parsedOverride);

    if (!hasOverride) return agreement;

    const currentTerms = parseAgreementTerms(agreement?.terms);
    return {
      ...agreement,
      terms: JSON.stringify({
        ...currentTerms,
        payment_amount: parsedOverride,
      }),
    };
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
          <div className="overflow-x-auto w-full">
            <table className="min-w-[1250px] w-full table-auto">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-2 whitespace-nowrap">Renter</th>
                  <th className="px-4 py-2 whitespace-nowrap">Listing</th>
                  <th className="px-4 py-2 whitespace-nowrap">Start Date</th>
                  <th className="px-4 py-2 whitespace-nowrap">Due Date</th>
                  <th className="px-4 py-2 whitespace-nowrap">Contract Date</th>
                  <th className="px-4 py-2 whitespace-nowrap">Payment</th>
                  <th className="px-4 py-2 whitespace-nowrap">
                    Payment Status
                  </th>
                  <th className="px-4 py-2 whitespace-nowrap"> Rent Status</th>
                  <th className="px-4 py-2 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((a) => {
                  const cycleDay = getRentCycleDay(a);
                  const isRedCycleRow =
                    typeof cycleDay === "number" &&
                    cycleDay >= 31 &&
                    cycleDay <= 37;

                  return (
                    <tr
                      key={a.id}
                      className={`border-b ${isRedCycleRow ? "bg-red-100" : ""}`}
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {a.renter?.full_name || "Unknown"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {a.listing?.title || "-"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
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
                      <td className="px-4 py-2 whitespace-nowrap">
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
                      <td className="px-4 py-2 whitespace-nowrap">
                        {editingId === a.id ? (
                          <input
                            type="date"
                            value={editValues.contract_date}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                contract_date: e.target.value,
                              })
                            }
                            className="input-field"
                          />
                        ) : a.end_date ? (
                          new Date(a.end_date).toLocaleDateString()
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-0 py-2 whitespace-nowrap">
                        {editingId === a.id ? (
                          <input
                            type="number"
                            min="0"
                            step="1.00"
                            value={editValues.payment_amount}
                            onChange={(e) =>
                              setEditValues({
                                ...editValues,
                                payment_amount: e.target.value,
                              })
                            }
                            className="input-field"
                            placeholder="Enter payment"
                          />
                        ) : (
                          (() => {
                            const amount = getPaymentAmountFromAgreement(a);
                            return amount > 0
                              ? `₱${amount.toLocaleString()}`
                              : "-";
                          })()
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {(() => {
                          const agreementForBadge =
                            editingId === a.id
                              ? buildAgreementWithPaymentOverride(
                                  a,
                                  editValues.payment_amount,
                                )
                              : a;

                          const paymentBadge =
                            getPaymentStatusBadge(agreementForBadge);

                          return (
                            <span
                              className={`inline-flex w-fit px-3 py-1 rounded-full text-sm font-semibold border ${paymentBadge.bgColor} ${paymentBadge.textColor} ${paymentBadge.borderColor}`}
                            >
                              {paymentBadge.text}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {(() => {
                          const timeBadge = getTimeStatusBadge(a);
                          return (
                            <span
                              className={`inline-flex w-fit px-3 py-1 rounded-full text-sm font-semibold border ${timeBadge.bgColor} ${timeBadge.textColor} ${timeBadge.borderColor}`}
                            >
                              {timeBadge.text}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap space-x-2">
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
                  );
                })}
              </tbody>
            </table>
          </div>
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
