import { Home, MapPin, Users, Wifi, Car, Droplet, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { applicationService, agreementService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Show correct badge for application status

const ListingCard = ({ listing }) => {
  const { user } = useAuth();
  const [applicationStatus, setApplicationStatus] = useState(null); // 'pending', 'accepted', 'rejected', 'cancelled', or null
  const totalRatings = Number(listing.totalRatings) || 0;
  const averageRatingRaw =
    Number(listing.averageRating ?? listing.average_rating) || 0;
  const averageRating = Number(averageRatingRaw.toFixed(1));
  const roundedStars = Math.min(5, Math.max(0, Math.floor(averageRating)));
  const visualStars = `${"★".repeat(roundedStars)}${"☆".repeat(5 - roundedStars)}`;

  useEffect(() => {
    checkApplicationStatus();
  }, [listing.id, user]);

  const checkApplicationStatus = async () => {
    if (!user || user.role !== "renter") {
      setApplicationStatus(null);
      return;
    }
    try {
      // Check agreements first (gives more accurate status)
      const agreements = await agreementService.getByUser();
      const agreement = agreements.find(
        (a) => a.listing?.id === listing.id || a.listing_id === listing.id,
      );

      if (agreement) {
        setApplicationStatus(agreement.status);
        return;
      }

      // Otherwise check applications
      const applications = await applicationService.getByUser();
      const app = applications.find((app) => app.listing_id === listing.id);
      if (app) {
        setApplicationStatus(app.status);
      } else {
        setApplicationStatus(null);
      }
    } catch (error) {
      console.error("Failed to check applications/agreements:", error);
      setApplicationStatus(null);
    }
  };

  const getAmenityIcon = (amenity) => {
    const icons = {
      wifi: Wifi,
      parking: Car,
      water: Droplet,
    };
    const Icon = icons[amenity.toLowerCase()] || Home;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Link to={`/listings/${listing.id}`}>
      <div className="card hover:scale-105 transition-transform duration-300">
        {/* Image */}
        <div className="h-48 bg-gradient-to-r from-primary-400 to-primary-600 relative overflow-hidden">
          {listing.images && listing.images.length > 0 ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Home className="h-16 w-16 text-white opacity-50" />
            </div>
          )}

          {/* Show listing status badge */}
          {listing.status === "approved" || listing.verified ? (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              Verified
            </div>
          ) : listing.status === "rejected" ? (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
              Rejected
            </div>
          ) : (
            <div className="absolute top-2 right-2 bg-yellow-400 text-white px-2 py-1 rounded-full text-xs font-semibold">
              Pending
            </div>
          )}

          {/* Show application status badge for renters */}
          {user && user.role === "renter" && applicationStatus && (
            <div
              className={`absolute top-9 right-2 text-white px-2 py-1 rounded-full text-xs font-semibold ${
                applicationStatus === "cancelled"
                  ? "bg-red-500"
                  : applicationStatus === "accepted" ||
                      applicationStatus === "confirmed" ||
                      applicationStatus === "active"
                    ? "bg-blue-500"
                    : applicationStatus === "pending"
                      ? "bg-yellow-500"
                      : "bg-gray-500"
              }`}
            >
              {applicationStatus === "cancelled"
                ? "Cancelled"
                : applicationStatus === "accepted" ||
                    applicationStatus === "confirmed" ||
                    applicationStatus === "active"
                  ? "Applied"
                  : applicationStatus === "pending"
                    ? "Pending"
                    : "Rejected"}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
            {listing.title}
          </h3>

          <div className="flex items-center text-gray-600 text-sm mb-2">
            <MapPin className="h-4 w-4 mr-1" />
            <span className="line-clamp-1">{listing.location}</span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center text-primary-600 font-bold text-xl">
              <span className="inline-flex items-center justify-center text-primary-600 mr-2 text-lg">
                ₱
              </span>
              <span>{listing.price}</span>
              <span className="text-sm text-gray-500 ml-1">/month</span>
            </div>
            <div className="flex items-center text-gray-600 text-sm">
              <Users className="h-4 w-4 mr-1" />
              <span>{listing.capacity} slots</span>
            </div>
          </div>

          <div className="flex items-center text-sm text-gray-600 mb-3">
            <Star className="h-4 w-4 mr-1 text-yellow-500" />
            <span className="text-yellow-500 mr-2" aria-hidden="true">
              {visualStars}
            </span>
            <span>
              {averageRating}/5 • {totalRatings} rating
              {totalRatings !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Amenities */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {listing.amenities.slice(0, 3).map((amenity, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded text-xs text-gray-600"
                >
                  {getAmenityIcon(amenity)}
                  <span>{amenity}</span>
                </div>
              ))}
              {listing.amenities.length > 3 && (
                <div className="text-xs text-gray-500 px-2 py-1">
                  +{listing.amenities.length - 3} more
                </div>
              )}
            </div>
          )}

          <p className="text-gray-600 text-sm mt-3 line-clamp-2">
            {listing.description}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ListingCard;
