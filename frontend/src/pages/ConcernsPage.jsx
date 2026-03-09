import React, { useEffect, useState } from "react";
import { concernService } from "../services/api";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import RenterSidebar from "../components/RenterSidebar";
import Footer from "../components/Footer";

export default function ConcernsPage() {
  const { user } = useAuth();
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("all");
  const [selectedConcern, setSelectedConcern] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [renterReplyText, setRenterReplyText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [renterAgreements, setRenterAgreements] = useState([]);
  const [ticketForm, setTicketForm] = useState({
    fullName: "",
    email: "",
    contactNumber: "",
    address: "",
    reason: "",
    description: "",
    listingId: "",
    boardingHouse: "",
    ownerName: "",
  });

  useEffect(() => {
    if (user) {
      setIsAdmin(user.role === "admin");
      setTicketForm((prev) => ({
        ...prev,
        fullName: user.fullName || "",
        email: user.email || "",
        contactNumber: user.phone || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchConcerns();
  }, [page, filter, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    fetchRenterAgreements();
  }, [user, isAdmin]);

  const fetchRenterAgreements = async () => {
    try {
      const agreements = await agreementService.getByUser();
      const validAgreements = (agreements || []).filter(
        (agreement) =>
          agreement?.listing?.id && agreement.status !== "cancelled",
      );
      setRenterAgreements(validAgreements);
    } catch (error) {
      console.error("Error fetching renter agreements:", error);
      toast.error("Failed to load your boarding house info");
    }
  };

  const handleTicketInput = (field, value) => {
    setTicketForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleListingSelect = (listingId) => {
    const selected = renterAgreements.find(
      (agreement) => agreement.listing?.id === listingId,
    );

    setTicketForm((prev) => ({
      ...prev,
      listingId,
      boardingHouse: selected?.listing?.title || prev.boardingHouse,
      ownerName: selected?.owner?.full_name || prev.ownerName,
      address:
        prev.address ||
        selected?.listing?.address ||
        selected?.listing?.location ||
        "",
    }));
  };

  const handleSubmitConcern = async (e) => {
    e.preventDefault();

    if (
      !ticketForm.fullName.trim() ||
      !ticketForm.email.trim() ||
      !ticketForm.contactNumber.trim() ||
      !ticketForm.address.trim() ||
      !ticketForm.reason.trim() ||
      !ticketForm.description.trim() ||
      !ticketForm.listingId ||
      !ticketForm.boardingHouse.trim() ||
      !ticketForm.ownerName.trim()
    ) {
      toast.error("Please complete all concern ticket fields");
      return;
    }

    try {
      setSubmitting(true);
      await concernService.create({
        listing_id: ticketForm.listingId,
        reason: ticketForm.reason,
        description: ticketForm.description,
        full_name: ticketForm.fullName,
        email: ticketForm.email,
        contact_number: ticketForm.contactNumber,
        address: ticketForm.address,
        boarding_house: ticketForm.boardingHouse,
        owner_name: ticketForm.ownerName,
      });

      toast.success("Concern ticket submitted successfully");
      setTicketForm((prev) => ({
        ...prev,
        reason: "",
        description: "",
      }));
      setPage(1);
      fetchConcerns();
    } catch (error) {
      console.error("Error submitting concern ticket:", error);
      toast.error(
        error?.response?.data?.message || "Failed to submit concern ticket",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fetchConcerns = async () => {
    try {
      setLoading(true);
      const selectedStatus = filter && filter !== "all" ? filter : undefined;
      let data;
      if (isAdmin) {
        data = await concernService.getAll(page, 20, selectedStatus);
      } else {
        data = await concernService.getOwnConcerns(page, 20, selectedStatus);
      }
      setConcerns(data.concerns || []);
      setTotalPages(Math.ceil((data.pagination?.total || 0) / 20));
    } catch (error) {
      console.error("Error fetching concerns:", error);
      toast.error("Failed to load concerns");
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (concernId) => {
    try {
      if (!responseText.trim()) {
        toast.error("Response cannot be empty");
        return;
      }

      await concernService.respond(concernId, {
        admin_response: responseText,
        status: "reviewed",
      });

      toast.success("Response sent successfully");
      setResponseText("");
      setSelectedConcern(null);
      fetchConcerns();
    } catch (error) {
      console.error("Error responding to concern:", error);
      toast.error("Failed to send response");
    }
  };

  const handleResolve = async (concernId) => {
    try {
      await concernService.resolve(concernId);
      toast.success("Concern marked as resolved");
      fetchConcerns();
    } catch (error) {
      console.error("Error resolving concern:", error);
      toast.error("Failed to resolve concern");
    }
  };

  const parseConcernThread = (threadText) => {
    const raw = (threadText || "").trim();
    if (!raw) return [];

    const lines = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const regex = /^\[(ADMIN|RENTER)\]\[(.*?)\]:\s*(.*)$/i;
    const messages = [];
    let recognized = 0;

    lines.forEach((line) => {
      const match = line.match(regex);
      if (!match) return;
      recognized += 1;
      messages.push({
        sender: match[1].toLowerCase(),
        timestamp: match[2],
        message: match[3] || "",
      });
    });

    if (recognized === 0 && raw) {
      return [
        {
          sender: "admin",
          timestamp: null,
          message: raw,
        },
      ];
    }

    return messages;
  };

  const canRenterReply = (concern) => {
    if (isAdmin) return false;
    if (!concern || concern.status === "resolved") return false;

    const thread = parseConcernThread(concern.admin_response);
    const adminCount = thread.filter((item) => item.sender === "admin").length;
    const renterCount = thread.filter(
      (item) => item.sender === "renter",
    ).length;
    const lastSender =
      thread.length > 0 ? thread[thread.length - 1].sender : null;

    return adminCount > 0 && renterCount < adminCount && lastSender === "admin";
  };

  const handleRenterReply = async (concernId) => {
    try {
      if (!renterReplyText.trim()) {
        toast.error("Reply cannot be empty");
        return;
      }

      await concernService.renterReply(concernId, {
        renter_response: renterReplyText,
      });

      toast.success("Reply sent successfully");
      setRenterReplyText("");
      setSelectedConcern(null);
      fetchConcerns();
    } catch (error) {
      console.error("Error sending renter reply:", error);
      toast.error(error?.response?.data?.message || "Failed to send reply");
    }
  };

  const parseConcernTicket = (descriptionText) => {
    const raw = (descriptionText || "").trim();
    if (!raw) {
      return { fields: [], issueDescription: "", isStructured: false };
    }

    const lines = raw.split("\n");
    const fieldLabels = [
      "Full Name",
      "Email",
      "Contact Number",
      "Address",
      "Boarding House",
      "Owner's Name",
    ];

    const fields = [];
    let issueDescription = "";
    let inIssueSection = false;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (/^Issue Description:\s*$/i.test(trimmed)) {
        inIssueSection = true;
        return;
      }

      if (inIssueSection) {
        issueDescription = issueDescription
          ? `${issueDescription}\n${trimmed}`
          : trimmed;
        return;
      }

      const colonIndex = trimmed.indexOf(":");
      if (colonIndex <= 0) return;

      const label = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      if (!fieldLabels.includes(label) || !value) return;

      fields.push({ label, value });
    });

    const isStructured = fields.length > 0;
    return {
      fields,
      issueDescription: issueDescription || (!isStructured ? raw : ""),
      isStructured,
    };
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        {isAdmin ? <AdminSidebar /> : <RenterSidebar />}

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isAdmin ? "All Concerns" : "My Concerns"}
            </h1>
            <p className="text-gray-600 mb-6">
              {isAdmin
                ? "Manage and respond to concerns from renters"
                : "Track and manage your boarding concerns"}
            </p>

            {!isAdmin && (
              <form
                onSubmit={handleSubmitConcern}
                className="mb-8 border border-gray-200 rounded-lg p-4 md:p-6 bg-gray-50"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Submit Concern Ticket
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={ticketForm.fullName}
                      onChange={(e) =>
                        handleTicketInput("fullName", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={ticketForm.email}
                      onChange={(e) =>
                        handleTicketInput("email", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={ticketForm.contactNumber}
                      onChange={(e) =>
                        handleTicketInput("contactNumber", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your contact number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={ticketForm.address}
                      onChange={(e) =>
                        handleTicketInput("address", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      What Boarding House
                    </label>
                    <select
                      value={ticketForm.listingId}
                      onChange={(e) => handleListingSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a boarding house</option>
                      {renterAgreements.map((agreement) => (
                        <option
                          key={agreement.id}
                          value={agreement.listing?.id}
                        >
                          {agreement.listing?.title} -{" "}
                          {agreement.owner?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Owner&apos;s Name
                    </label>
                    <input
                      type="text"
                      value={ticketForm.ownerName}
                      onChange={(e) =>
                        handleTicketInput("ownerName", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter owner's name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Boarding House (Type)
                    </label>
                    <input
                      type="text"
                      value={ticketForm.boardingHouse}
                      onChange={(e) =>
                        handleTicketInput("boardingHouse", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Type boarding house name"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={ticketForm.reason}
                      onChange={(e) =>
                        handleTicketInput("reason", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Reason for concern"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={ticketForm.description}
                      onChange={(e) =>
                        handleTicketInput("description", e.target.value)
                      }
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe the issue in detail"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit Concern"}
                  </button>
                </div>
              </form>
            )}

            {/* Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Concerns List */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading concerns...</p>
              </div>
            ) : concerns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No concerns found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {concerns.map((concern) =>
                  (() => {
                    const parsedTicket = parseConcernTicket(
                      concern.description,
                    );
                    return (
                      <div
                        key={concern.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {concern.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {isAdmin &&
                                `From: ${concern.users?.full_name || "Unknown"}`}
                              {!isAdmin &&
                                `Listing: ${concern.listings?.title || "Unknown"}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-block px-3 py-1 text-sm rounded-full font-medium ${
                                concern.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : concern.status === "reviewed"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {concern.status}
                            </span>
                          </div>
                        </div>

                        {isAdmin && parsedTicket.isStructured ? (
                          <div className="mb-3 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                            {parsedTicket.fields.map((field) => (
                              <div
                                key={`${concern.id}-${field.label}`}
                                className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-3"
                              >
                                <span className="text-sm font-semibold text-gray-700">
                                  {field.label}
                                </span>
                                <span className="text-sm text-gray-700 break-words">
                                  {field.value}
                                </span>
                              </div>
                            ))}

                            <div className="pt-2 border-t border-gray-200">
                              <p className="text-sm font-semibold text-gray-700 mb-1">
                                Description
                              </p>
                              <p className="text-sm text-gray-700 whitespace-pre-line">
                                {parsedTicket.issueDescription ||
                                  "No description provided"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 mb-3 whitespace-pre-line">
                            {concern.description}
                          </p>
                        )}

                        {concern.admin_response && (
                          <div className="bg-gray-50 p-3 rounded mb-3">
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              Conversation:
                            </p>
                            <div className="space-y-2">
                              {parseConcernThread(concern.admin_response).map(
                                (entry, index) => (
                                  <div
                                    key={`${concern.id}-thread-${index}`}
                                    className={`rounded px-3 py-2 text-sm ${
                                      entry.sender === "admin"
                                        ? "bg-blue-50 border border-blue-200"
                                        : "bg-green-50 border border-green-200"
                                    }`}
                                  >
                                    <p className="font-semibold text-gray-700 mb-1">
                                      {entry.sender === "admin"
                                        ? "Admin"
                                        : "Sender"}
                                    </p>
                                    <p className="text-gray-700 whitespace-pre-line">
                                      {entry.message}
                                    </p>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-4">
                          <p className="text-xs text-gray-500">
                            {new Date(concern.created_at).toLocaleDateString()}
                          </p>
                          {isAdmin ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedConcern(concern.id)}
                                className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                              >
                                Respond
                              </button>
                              {concern.status !== "resolved" && (
                                <button
                                  onClick={() => handleResolve(concern.id)}
                                  className="px-3 py-1 text-sm bg-green-100 text-green-600 hover:bg-green-200 rounded"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          ) : (
                            concern.status !== "resolved" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedConcern(concern.id);
                                    setResponseText("");
                                  }}
                                  disabled={!canRenterReply(concern)}
                                  className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded disabled:opacity-50"
                                  title={
                                    canRenterReply(concern)
                                      ? "Reply to admin"
                                      : "Wait for admin reply before you can reply again"
                                  }
                                >
                                  Reply to Admin
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        {/* Response Form */}
                        {selectedConcern === concern.id && isAdmin && (
                          <div className="mt-4 p-4 bg-gray-50 rounded">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Admin Response
                            </label>
                            <textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Type your response here..."
                              rows="4"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleRespond(concern.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Send Response
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedConcern(null);
                                  setResponseText("");
                                  setRenterReplyText("");
                                }}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedConcern === concern.id &&
                          !isAdmin &&
                          canRenterReply(concern) && (
                            <div className="mt-4 p-4 bg-green-50 rounded border border-green-100">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your Reply
                              </label>
                              <textarea
                                value={renterReplyText}
                                onChange={(e) =>
                                  setRenterReplyText(e.target.value)
                                }
                                placeholder="Type your reply to admin..."
                                rows="4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleRenterReply(concern.id)}
                                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Send Reply
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedConcern(null);
                                    setRenterReplyText("");
                                  }}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                        {!isAdmin &&
                          concern.status !== "resolved" &&
                          concern.admin_response &&
                          !canRenterReply(concern) && (
                            <p className="mt-3 text-xs text-gray-500">
                              You can reply once after each admin response.
                              Please wait for admin to reply again.
                            </p>
                          )}
                      </div>
                    );
                  })(),
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
