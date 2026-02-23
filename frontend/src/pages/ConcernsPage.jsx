import React, { useEffect, useState } from "react";
import { concernService } from "../services/api";
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
  const [filter, setFilter] = useState("");
  const [selectedConcern, setSelectedConcern] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      setIsAdmin(user.role === "admin");
    }
  }, [user]);

  useEffect(() => {
    fetchConcerns();
  }, [page, filter, isAdmin]);

  const fetchConcerns = async () => {
    try {
      setLoading(true);
      let data;
      if (isAdmin) {
        data = await concernService.getAll(page, 20, filter);
      } else {
        data = await concernService.getOwnConcerns(page, 20, filter);
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
                <option value="">All</option>
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
                {concerns.map((concern) => (
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

                    <p className="text-gray-700 mb-3">{concern.description}</p>

                    {concern.admin_response && (
                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                          Admin Response:
                        </p>
                        <p className="text-sm text-gray-600">
                          {concern.admin_response}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-4">
                      <p className="text-xs text-gray-500">
                        {new Date(concern.created_at).toLocaleDateString()}
                      </p>
                      {isAdmin && (
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
                      )}
                    </div>

                    {/* Response Form */}
                    {selectedConcern === concern.id && (
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
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
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
