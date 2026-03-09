import { useState, useEffect } from "react";
import { agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ListingCard from "../components/ListingCard";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import { Mail, Phone, User, X } from "lucide-react";
import {
  getPaymentStatusBadge,
  getTimeStatusBadge,
} from "../utils/renterStatus";

const MyBoardingPage = () => {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOwner, setSelectedOwner] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    try {
      const data = await agreementService.getByUser();
      // only renters should see this page
      setAgreements(data.filter((a) => a.renter_id === user.id));
    } catch (err) {
      console.error("Failed to load agreements", err);
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold text-gray-900">My Boarding</h1>
          <p className="text-gray-600 mt-2">
            View boarding houses you have rented
          </p>
        </div>

        {agreements.length > 0 ? (
          <div className="space-y-6">
            {agreements.map((agreement) => {
              const paymentBadge = getPaymentStatusBadge(agreement);
              const timeBadge = getTimeStatusBadge(agreement);
              const isUnpaid = paymentBadge.text === "Unpaid";
              const isOverdue = timeBadge.text
                .toLowerCase()
                .startsWith("overdue");
              const shouldShowContactOwner = isUnpaid && isOverdue;

              return (
                <div
                  key={agreement.id}
                  className="card p-6 flex flex-col md:flex-row md:items-center"
                >
                  <div className="flex-1">
                    <ListingCard listing={agreement.listing} />
                  </div>
                  <div className="mt-4 md:mt-0 md:ml-10 flex flex-col space-y-2">
                    <p>
                      <span className=" font-medium">Start date:</span>{" "}
                      {agreement.renter_confirmed_at
                        ? new Date(
                            agreement.renter_confirmed_at,
                          ).toLocaleDateString()
                        : "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Due date:</span>{" "}
                      {agreement.due_date
                        ? new Date(agreement.due_date).toLocaleDateString()
                        : "N/A"}
                    </p>
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${paymentBadge.bgColor} ${paymentBadge.textColor} ${paymentBadge.borderColor}`}
                        >
                          {paymentBadge.text}
                        </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${timeBadge.bgColor} ${timeBadge.textColor} ${timeBadge.borderColor}`}
                        >
                          {timeBadge.text}
                        </span>
                      </div>
                    </div>
                    {shouldShowContactOwner && (
                      <button
                        className="btn-primary btn-sm w-max"
                        onClick={() => setSelectedOwner(agreement.owner)}
                      >
                        Contact Owner
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-600">You have no active boardings.</p>
          </div>
        )}
      </div>

      {/* Owner Contact Modal */}
      {selectedOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Contact Owner
              </h2>
              <button
                onClick={() => setSelectedOwner(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg">
                {selectedOwner.profilePicture ||
                selectedOwner.profile_picture ? (
                  <img
                    src={
                      selectedOwner.profilePicture ||
                      selectedOwner.profile_picture
                    }
                    alt={`${selectedOwner.fullName || selectedOwner.full_name || "Owner"}'s profile`}
                    className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                    {(selectedOwner.fullName || selectedOwner.full_name || "O")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 p-0 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Owner Name</p>
                  <p className="font-semibold text-gray-900">
                    {selectedOwner.fullName || selectedOwner.full_name}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-0 bg-gray-50 rounded-lg">
                <Phone className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="font-semibold text-gray-900">
                    {selectedOwner.phone || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-0 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-900">
                    {selectedOwner.email || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedOwner(null)}
              className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MyBoardingPage;
