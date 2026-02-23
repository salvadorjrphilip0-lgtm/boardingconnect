import { Home, MapPin, Users, Wifi, Car, Droplet } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { applicationService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const ListingCard = ({ listing }) => {
  const { user } = useAuth();
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    checkIfApplied();
  }, [listing.id, user]);

  const checkIfApplied = async () => {
    if (!user || user.role !== "renter") {
      setHasApplied(false);
      return;
    }
    try {
      const applications = await applicationService.getByUser();
      const alreadyApplied = applications.some(
        (app) => app.listing_id === listing.id
      );
      setHasApplied(alreadyApplied);
    } catch (error) {
      console.error("Failed to check applications:", error);
      setHasApplied(false);
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
          {listing.status === "approved" || listing.verified ? (
            <>
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                Verified
              </div>
              {hasApplied && (
                <div className="absolute top-9 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  Applied
                </div>
              )}
            </>
          ) : listing.status === "rejected" ? (
            <>
              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                Rejected
              </div>
              {hasApplied && (
                <div className="absolute top-9 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  Applied
                </div>
              )}
            </>
          ) : (
            <>
              <div className="absolute top-2 right-2 bg-yellow-400 text-white px-2 py-1 rounded-full text-xs font-semibold">
                Pending
              </div>
              {hasApplied && (
                <div className="absolute top-9 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  Applied
                </div>
              )}
            </>
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
