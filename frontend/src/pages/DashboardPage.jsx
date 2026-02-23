import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  MessageSquare,
  FileText,
  PlusCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  listingService,
  applicationService,
  agreementService,
} from "../services/api";
import Navbar from "../components/Navbar";
import OwnerSidebar from "../components/OwnerSidebar";
import RenterSidebar from "../components/RenterSidebar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    listings: 0,
    applications: 0,
    agreements: 0,
    messages: 0,
  });
  const [myListings, setMyListings] = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear previous state and refetch dashboard data whenever the
    // authenticated user changes (login/logout/account switch). This
    // ensures each account sees only their own listings/applications.
    if (!user) {
      setMyListings([]);
      setRecentApplications([]);
      setStats({ listings: 0, applications: 0, agreements: 0, messages: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setMyListings([]);
    setRecentApplications([]);
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;

      if (user.role === "owner") {
        const listings = await listingService.getAll({ ownerId: user.id });
        setMyListings(listings);
        setStats((prev) => ({ ...prev, listings: listings.length }));
      }

      // Applications fetched are scoped to the authenticated user on the server
      const applications = await applicationService.getByUser();
      // If owner, show recent applications to their listings
      if (user.role === "owner") {
        setRecentApplications(applications.slice(0, 5));
      }
      const agreements = await agreementService.getByUser();

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

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {user.role === "owner" && (
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">My Listings</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.listings}
                    </p>
                  </div>
                  <Home className="h-12 w-12 text-primary-600" />
                </div>
              </div>
            )}

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Applications</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.applications}
                  </p>
                </div>
                <FileText className="h-12 w-12 text-blue-600" />
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Agreements</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.agreements}
                  </p>
                </div>
                <FileText className="h-12 w-12 text-green-600" />
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Messages</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats.messages}
                  </p>
                </div>
                <MessageSquare className="h-12 w-12 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/listings" className="btn-outline">
                Browse Listings
              </Link>
              <Link to="/messages" className="btn-outline">
                View Messages
              </Link>
              {user.role === "owner" && (
                <Link to="/create-listing" className="btn-primary">
                  <PlusCircle className="inline h-5 w-5 mr-2" />
                  Create Listing
                </Link>
              )}
            </div>
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
                {myListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-900">
                          {listing.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {listing.location}
                        </p>
                        <p className="text-primary-600 font-semibold mt-2">
                          ₱{listing.price}/month
                        </p>
                      </div>
                      <div className="flex space-x-2">
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
                ))}
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
                    {recentApplications.map((app) => (
                      <div key={app.id} className="border rounded p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">
                              {app.listing?.title}
                            </p>
                            <p className="text-sm text-gray-600">
                              Applicant: {app.applicant?.full_name}
                            </p>
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
                    ))}
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
              <div className="text-gray-600">
                <Link
                  to="/agreements"
                  className="text-primary-600 hover:text-primary-700"
                >
                  View all agreements →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default DashboardPage;
