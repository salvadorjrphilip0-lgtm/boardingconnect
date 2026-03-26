import React, { useEffect, useState } from "react";
import {
  reviewService,
  websiteReviewService,
  ownerReviewService,
} from "../services/api";
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function ReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [ownerReviews, setOwnerReviews] = useState([]);
  const [ownerAverageRating, setOwnerAverageRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [websiteSummary, setWebsiteSummary] = useState({
    total_reviews: 0,
    average_rating: 0,
  });
  const [websiteReviews, setWebsiteReviews] = useState([]);

  useEffect(() => {
    if (!selectedReviewer) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedReviewer(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedReviewer]);

  useEffect(() => {
    fetchAllReviews();
  }, [page]);

  const fetchAllReviews = async () => {
    try {
      setLoading(true);
      // These endpoints require admin role
      const [data, websiteData] = await Promise.all([
        reviewService.getAll(page, 20),
        websiteReviewService.getAdminSummary(),
      ]);

      const ownerReviewData = await ownerReviewService.getAll(page, 20);

      setReviews(data.reviews || []);
      setAverageRating(Number(data.average_rating) || 0);
      setTotalPages(Math.ceil((data.pagination?.total || 0) / 20));

      setOwnerReviews(ownerReviewData.reviews || []);
      setOwnerAverageRating(Number(ownerReviewData.average_rating) || 0);

      setWebsiteSummary({
        total_reviews: websiteData?.summary?.total_reviews || 0,
        average_rating: Number(websiteData?.summary?.average_rating) || 0,
      });
      setWebsiteReviews(websiteData?.reviews || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const deleteReview = async (reviewId) => {
    try {
      if (window.confirm("Are you sure you want to delete this review?")) {
        await reviewService.delete(reviewId);
        toast.success("Review deleted successfully");
        fetchAllReviews();
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
    }
  };

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
              Only administrators can view this page.
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews</h1>
            <p className="text-gray-600 mb-6">
              Manage and monitor all system reviews
            </p>

            {/* Summary Stats */}
            <div className="space-y-4 mb-8">
              {/* Review Counts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Boarding House Reviews
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {reviews.length}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Owner Reviews</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {ownerReviews.length}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">System Reviews</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {websiteSummary.total_reviews}
                  </p>
                </div>
              </div>

              {/* Average Ratings Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Boarding House Avg Rating
                  </p>
                  <p className="text-3xl font-bold text-green-600">
                    {averageRating}/5
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Owner Avg Rating</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {ownerAverageRating}/5
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">System Avg Rating</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {websiteSummary.average_rating}/5
                  </p>
                </div>
              </div>

              {/* Total Reviews and Total Avg Rating Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300">
                  <p className="text-sm text-gray-700 font-semibold">
                    Total Reviews
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {reviews.length +
                      ownerReviews.length +
                      websiteSummary.total_reviews}
                  </p>
                </div>
                <div className="bg-gray-100 p-4 rounded-lg border-2 border-gray-300">
                  <p className="text-sm text-gray-700 font-semibold">
                    Total Avg Rating
                  </p>
                  <p className="text-3xl font-bold text-gray-800">
                    {(
                      (averageRating +
                        ownerAverageRating +
                        websiteSummary.average_rating) /
                      3
                    ).toFixed(2)}
                    /5
                  </p>
                </div>
              </div>
            </div>

            {/* Website Rating Reviews Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Website Rating Reviews
              </h2>
              {websiteReviews.length === 0 ? (
                <div className="border border-gray-200 rounded-lg p-4 text-gray-600">
                  No website reviews submitted yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {websiteReviews.map((review) => (
                    <div
                      key={`website-${review.id}`}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {review.full_name}
                          </p>
                          <p className="text-xs text-gray-500 uppercase">
                            {review.role}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-yellow-500">
                            {"⭐".repeat(review.rating)}
                          </div>
                          <p className="text-sm text-gray-600">
                            {review.rating}/5
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-700 mt-2">{review.comment}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {review.reviewed_at
                          ? new Date(review.reviewed_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Boarding House Reviews Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Boarding House Reviews
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading reviews...</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    No boarding house reviews found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                          {review.users?.profile_picture ? (
                            <img
                              src={review.users.profile_picture}
                              alt={`${review.users?.full_name || "Renter"} profile`}
                              className="h-10 w-10 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-600 font-semibold">
                              {(review.users?.full_name || "R")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {review.users?.full_name || "Unknown User"}
                            </h3>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReviewer({
                                  fullName:
                                    review.users?.full_name || "Unknown User",
                                  profilePicture:
                                    review.users?.profile_picture || null,
                                })
                              }
                              className="text-sm text-gray-600 hover:text-primary-700 underline"
                            >
                              By: {review.users?.full_name || "Unknown User"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-500">
                              {"⭐".repeat(review.rating)}
                            </div>
                            <p className="text-sm text-gray-600">
                              {review.rating}/5
                            </p>
                          </div>
                          <button
                            onClick={() => deleteReview(review.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {review.title && (
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          {review.title}
                        </p>
                      )}
                      <p className="text-gray-700">
                        {review.comment || "No comment"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Owner Profile Reviews Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Owner Profile Reviews
              </h2>
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading owner reviews...</p>
                </div>
              ) : ownerReviews.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    No owner profile reviews found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ownerReviews.map((review) => (
                    <div
                      key={review.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-3">
                          {review.users?.profile_picture ? (
                            <img
                              src={review.users.profile_picture}
                              alt={`${review.users?.full_name || "Renter"} profile`}
                              className="h-10 w-10 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm text-gray-600 font-semibold">
                              {(review.users?.full_name || "R")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {review.users?.full_name || "Unknown User"}
                            </h3>
                            <p className="text-xs text-gray-500">
                              Owner:{" "}
                              {review.owners?.full_name || "Unknown Owner"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Listing:{" "}
                              {review.listings?.title || "Unknown Listing"}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReviewer({
                                  fullName:
                                    review.users?.full_name || "Unknown User",
                                  profilePicture:
                                    review.users?.profile_picture || null,
                                })
                              }
                              className="text-sm text-gray-600 hover:text-primary-700 underline"
                            >
                              By: {review.users?.full_name || "Unknown User"}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-500">
                              {"⭐".repeat(review.rating)}
                            </div>
                            <p className="text-sm text-gray-600">
                              {review.rating}/5
                            </p>
                          </div>
                        </div>
                      </div>
                      {review.title && (
                        <p className="text-sm font-semibold text-gray-800 mb-1">
                          {review.title}
                        </p>
                      )}
                      <p className="text-gray-700">
                        {review.comment || "No comment"}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination for Boarding House Reviews */}
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

      {selectedReviewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setSelectedReviewer(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reviewer Profile
            </h3>

            <div className="flex items-center gap-4">
              {selectedReviewer.profilePicture ? (
                <img
                  src={selectedReviewer.profilePicture}
                  alt={`${selectedReviewer.fullName} profile`}
                  className="h-16 w-16 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl text-gray-700 font-semibold">
                  {selectedReviewer.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold text-gray-900">
                  {selectedReviewer.fullName}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReviewer(null)}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
