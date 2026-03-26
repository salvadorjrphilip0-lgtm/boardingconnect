import React, { useEffect, useMemo, useState } from "react";
import {
  agreementService,
  listingService,
  reviewService,
  websiteReviewService,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { getTimeStatusBadge } from "../utils/renterStatus";

export default function ReportsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [ownerRows, setOwnerRows] = useState([]);
  const [roomRows, setRoomRows] = useState([]);
  const [boardingHouseReviews, setBoardingHouseReviews] = useState([]);
  const [boardingHouseReviewSummary, setBoardingHouseReviewSummary] = useState({
    total_reviews: 0,
    average_rating: 0,
  });
  const [systemReviews, setSystemReviews] = useState([]);
  const [systemReviewSummary, setSystemReviewSummary] = useState({
    total_reviews: 0,
    average_rating: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [agreements, listings, reviewData, websiteReviewData] =
        await Promise.all([
          agreementService.getAll(),
          listingService.getAll(),
          reviewService.getAll(1, 1000),
          websiteReviewService.getAdminSummary(),
        ]);

      const renterRows = (agreements || [])
        .filter((agreement) => agreement?.renter?.id)
        .map((agreement) => {
          const moveInDate = agreement.renter_confirmed_at || null;
          const dueDate = agreement.due_date || null;
          const contractDate = agreement.end_date || null;

          return {
            id: agreement.id,
            renterName: agreement.renter?.full_name || "Unknown Renter",
            contactNumber: agreement.renter?.phone || "N/A",
            boardingHouseTitle: agreement.listing?.title || "Untitled Listing",
            moveInDate,
            dueDate,
            contractDate,
            rentStatus: agreement.rent_status,
          };
        });

      const occupancyAgreements = (agreements || []).filter((agreement) => {
        if (!agreement?.renter?.id) return false;

        const normalizedStatus = String(agreement.status || "").toLowerCase();
        return (
          normalizedStatus === "confirmed" || normalizedStatus === "active"
        );
      });

      const rentersByListingId = occupancyAgreements.reduce(
        (acc, agreement) => {
          const listingId = agreement?.listing?.id || agreement?.listing_id;
          if (!listingId) return acc;

          if (!acc[listingId]) {
            acc[listingId] = [];
          }

          const renterName = agreement?.renter?.full_name?.trim();
          if (renterName && !acc[listingId].includes(renterName)) {
            acc[listingId].push(renterName);
          }

          return acc;
        },
        {},
      );

      const mappedRooms = (listings || []).map((listing) => {
        const assignedRenters = rentersByListingId[listing.id] || [];
        const occupiedSlots = assignedRenters.length;
        const amenities = Array.isArray(listing.amenities)
          ? listing.amenities.join(", ")
          : listing.amenities || "N/A";
        const slotsRemaining = Number.isFinite(listing.capacity)
          ? Math.max(0, listing.capacity)
          : 0;

        return {
          id: listing.id,
          title: listing.title || "Untitled Listing",
          location: listing.location || "N/A",
          amenities,
          occupiedSlots,
          slotsRemaining,
          occupancyStatus: `${occupiedSlots} occupied • ${slotsRemaining} remaining`,
          renterAssigned:
            assignedRenters.length > 0 ? assignedRenters.join(", ") : "-",
        };
      });

      const ownerPostedCountById = (listings || []).reduce((acc, listing) => {
        const ownerId =
          listing.ownerId || listing.owner?.id || listing.owner_id || null;
        if (!ownerId) return acc;

        acc[ownerId] = (acc[ownerId] || 0) + 1;
        return acc;
      }, {});

      const mappedOwnerRows = (listings || [])
        .map((listing) => {
          const ownerId =
            listing.ownerId || listing.owner?.id || listing.owner_id || null;
          const ownerName =
            listing.owner?.fullName ||
            listing.owner?.full_name ||
            listing.owner?.name ||
            "Unknown Owner";
          const ownerContact = listing.owner?.phone || "N/A";
          const ownerEmail = listing.owner?.email || "N/A";
          const renters = rentersByListingId[listing.id] || [];

          return {
            id: `${ownerId || "unknown-owner"}-${listing.id || "unknown-listing"}`,
            ownerKey: ownerId || `${ownerName}-${ownerEmail}`,
            ownerName,
            contactNumber: ownerContact,
            email: ownerEmail,
            postedCount: ownerId ? ownerPostedCountById[ownerId] || 0 : 0,
            renters: renters.length > 0 ? renters.join(", ") : "-",
            boardingHouseTitle: listing.title || "Untitled Listing",
            date: listing.createdAt || listing.created_at || null,
          };
        })
        .sort((a, b) => String(a.ownerName).localeCompare(String(b.ownerName)));

      setRows(renterRows);
      setOwnerRows(mappedOwnerRows);
      setRoomRows(mappedRooms);

      const mappedBoardingHouseReviews = (reviewData?.reviews || []).map(
        (review) => ({
          id: review.id,
          renterName: review.users?.full_name || "Unknown Renter",
          boardingHouseTitle: review.listings?.title || "Untitled Listing",
          boardingHouseOwner:
            review.listings?.owner?.full_name || "Unknown Owner",
          comment: review.comment || "-",
          rating: Number(review.rating) || 0,
        }),
      );

      setBoardingHouseReviews(mappedBoardingHouseReviews);
      setBoardingHouseReviewSummary({
        total_reviews:
          Number(reviewData?.pagination?.total) ||
          mappedBoardingHouseReviews.length,
        average_rating: Number(reviewData?.average_rating) || 0,
      });

      const mappedSystemReviews = (websiteReviewData?.reviews || []).map(
        (review) => ({
          id: review.id,
          name: review.full_name || "Unknown User",
          role: review.role || "unknown",
          comment: review.comment || "-",
          rating: Number(review.rating) || 0,
        }),
      );

      setSystemReviews(mappedSystemReviews);
      setSystemReviewSummary({
        total_reviews: Number(websiteReviewData?.summary?.total_reviews) || 0,
        average_rating: Number(websiteReviewData?.summary?.average_rating) || 0,
      });
    } catch (error) {
      console.error("Failed to load admin reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
  };

  const getDurationOfStay = (moveInDateValue) => {
    if (!moveInDateValue) return "-";

    const moveInDate = new Date(moveInDateValue);
    const today = new Date();

    if (Number.isNaN(moveInDate.getTime())) return "-";

    moveInDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const days = Math.max(
      0,
      Math.floor((today - moveInDate) / (1000 * 60 * 60 * 24)),
    );

    return `${days} day${days === 1 ? "" : "s"}`;
  };

  const getRenterStatus = (moveInDateValue, dueDateValue, rentStatus) =>
    getTimeStatusBadge({
      renter_confirmed_at: moveInDateValue,
      due_date: dueDateValue,
      rent_status: rentStatus,
    });

  const formatUserRole = (role) => {
    if (!role) return "-";
    const normalizedRole = String(role).toLowerCase();
    return normalizedRole === "renter"
      ? "Renter"
      : normalizedRole === "owner"
        ? "Owner"
        : role;
  };

  const totalRenters = useMemo(() => rows.length, [rows]);
  const totalOwners = useMemo(
    () => new Set(ownerRows.map((row) => row.ownerKey)).size,
    [ownerRows],
  );
  const totalRooms = useMemo(() => roomRows.length, [roomRows]);
  const totalOccupancy = useMemo(
    () =>
      roomRows.reduce(
        (total, row) => total + (Number(row.occupiedSlots) || 0),
        0,
      ),
    [roomRows],
  );
  const totalSlotsRemaining = useMemo(
    () =>
      roomRows.reduce(
        (total, row) => total + (Number(row.slotsRemaining) || 0),
        0,
      ),
    [roomRows],
  );

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600">
              Only administrators can view reports.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        <AdminSidebar />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-2">
              Admin report summary
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Renter Records
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  Total Renter: {totalRenters}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading renter report...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No renters found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-center">Name</th>
                      <th className="px-3 py-2 text-center">Contact Number</th>
                      <th className="px-3 py-2 text-center">
                        Boarding House Title
                      </th>
                      <th className="px-3 py-2 text-center">Start Date</th>
                      <th className="px-3 py-2 text-center">Due Date</th>
                      <th className="px-3 py-2 text-center">
                        Contract Date (Optional)
                      </th>
                      <th className="px-3 py-2 text-center">
                        Duration of Stay
                      </th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const status = getRenterStatus(
                        row.moveInDate,
                        row.dueDate,
                        row.rentStatus,
                      );
                      return (
                        <tr key={row.id} className="border-b">
                          <td className="px-3 py-2">{row.renterName}</td>
                          <td className="px-3 py-2">{row.contactNumber}</td>
                          <td className="px-3 py-2">
                            {row.boardingHouseTitle}
                          </td>
                          <td className="px-3 py-2">
                            {formatDate(row.moveInDate)}
                          </td>
                          <td className="px-3 py-2">
                            {formatDate(row.dueDate)}
                          </td>
                          <td className="px-3 py-2">
                            {formatDate(row.contractDate)}
                          </td>
                          <td className="px-3 py-2">
                            {getDurationOfStay(row.moveInDate)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${status.style}`}
                            >
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Property Owner Records
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  Total Owners: {totalOwners}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading owner report...</p>
              </div>
            ) : ownerRows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No owner reports found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-center">Name</th>
                      <th className="px-3 py-2 text-center">Contact Number</th>
                      <th className="px-3 py-2 text-center">Email</th>
                      <th className="px-3 py-2 text-center">Posted Count</th>
                      <th className="px-3 py-2 text-center">Renters</th>
                      <th className="px-3 py-2 text-center">
                        Boarding House Title
                      </th>
                      <th className="px-3 py-2 text-center">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownerRows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">{row.ownerName}</td>
                        <td className="px-3 py-2">{row.contactNumber}</td>
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="px-3 py-2">{row.postedCount}</td>
                        <td className="px-3 py-2">{row.renters}</td>
                        <td className="px-3 py-2">{row.boardingHouseTitle}</td>
                        <td className="px-3 py-2">{formatDate(row.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Boarding House &amp; Occupancy Report
              </h2>
              <div className="mt-3 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  Total Boarding House: {totalRooms}
                </span>
                <span className="inline-flex items-center rounded-full border border-green-300 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Total Occupancy: {totalOccupancy}
                </span>
                <span className="inline-flex items-center rounded-full border border-blue-300 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Total Slots Remaining: {totalSlotsRemaining}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  Loading room occupancy report...
                </p>
              </div>
            ) : roomRows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No rooms/listings found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-center">Title</th>
                      <th className="px-3 py-2 text-center">Location</th>
                      <th className="px-3 py-2 text-center">Amenities</th>
                      <th className="px-3 py-2 text-center">Slots Remaining</th>
                      <th className="px-3 py-2 text-center">
                        Occupancy Status
                      </th>
                      <th className="px-3 py-2 text-center">Renter Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomRows.map((room) => {
                      const occupied = room.occupiedSlots > 0;

                      return (
                        <tr key={room.id} className="border-b">
                          <td className="px-3 py-2">{room.title}</td>
                          <td className="px-3 py-2">{room.location}</td>
                          <td className="px-3 py-2">{room.amenities}</td>
                          <td className="px-3 py-2">{room.slotsRemaining}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                occupied
                                  ? "bg-green-100 text-green-700 border-green-300"
                                  : "bg-amber-100 text-amber-700 border-amber-300"
                              }`}
                            >
                              {room.occupancyStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2">{room.renterAssigned}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Boarding House Review
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  Loading boarding house reviews...
                </p>
              </div>
            ) : boardingHouseReviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No boarding house reviews yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-center">Name of Renter</th>
                      <th className="px-3 py-2 text-center">
                        Boarding House Title
                      </th>
                      <th className="px-3 py-2 text-center">
                        Boarding House Owner
                      </th>
                      <th className="px-3 py-2 text-center">Comment</th>
                      <th className="px-3 py-2 text-center">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boardingHouseReviews.map((review) => (
                      <tr key={review.id} className="border-b">
                        <td className="px-3 py-2">{review.renterName}</td>
                        <td className="px-3 py-2">
                          {review.boardingHouseTitle}
                        </td>
                        <td className="px-3 py-2">
                          {review.boardingHouseOwner}
                        </td>
                        <td className="px-3 py-2">{review.comment}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-yellow-600">
                            {review.rating}/5
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <span className="font-semibold">Overall Review:</span>{" "}
                  {boardingHouseReviewSummary.average_rating}/5 from{" "}
                  {boardingHouseReviewSummary.total_reviews} review
                  {boardingHouseReviewSummary.total_reviews === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                System Review
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading system reviews...</p>
              </div>
            ) : systemReviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No system reviews yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-center">Name</th>
                      <th className="px-3 py-2 text-center">User Status</th>
                      <th className="px-3 py-2 text-center">Comment</th>
                      <th className="px-3 py-2 text-center">Ratings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemReviews.map((review) => (
                      <tr key={`system-${review.id}`} className="border-b">
                        <td className="px-3 py-2">{review.name}</td>
                        <td className="px-3 py-2">
                          {formatUserRole(review.role)}
                        </td>
                        <td className="px-3 py-2">{review.comment}</td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-yellow-600">
                            {review.rating}/5
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <span className="font-semibold">Overall Review:</span>{" "}
                  {systemReviewSummary.average_rating}/5 from{" "}
                  {systemReviewSummary.total_reviews} review
                  {systemReviewSummary.total_reviews === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
