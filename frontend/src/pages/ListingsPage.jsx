import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Search, Filter, MapPin } from "lucide-react";
import { listingService } from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ListingCard from "../components/ListingCard";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";

const ListingsPage = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    location: "",
    minPrice: "",
    maxPrice: "",
    verified: false,
  });

  const { user } = useAuth();

  useEffect(() => {
    // Fetch listings when component mounts and whenever the authenticated
    // user changes (login/logout) or filters change. This prevents showing
    // stale data from a previous account session.
    setLoading(true);
    setListings([]);
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filters]);

  const fetchListings = async () => {
    try {
      let data = await listingService.getAll(filters);
      // hide any listings with no remaining slots from renters
      if (user && user.role === "renter") {
        data = data.filter((l) => l.capacity > 0);
      }
      setListings(data);
    } catch (error) {
      console.error("Failed to fetch listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchListings();
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {user && (user.role === "owner" ? <OwnerSidebar /> : <RenterSidebar />)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Browse Listings</h1>
          <p className="text-gray-600 mt-2">Find your perfect boarding house</p>
        </div>

        {/* Search and Filters */}
        <div className="card p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search by name or description..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="location"
                  value={filters.location}
                  onChange={handleFilterChange}
                  placeholder="Location"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <input
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleFilterChange}
                placeholder="Min Price"
                className="input-field"
              />
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleFilterChange}
                placeholder="Max Price"
                className="input-field"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                name="verified"
                id="verified"
                checked={filters.verified}
                onChange={handleFilterChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="verified" className="ml-2 text-sm text-gray-700">
                Verified listings only
              </label>
            </div>

            <button onClick={handleSearch} className="btn-primary">
              <Filter className="inline h-5 w-5 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings
              .filter(
                (l) => !(user && user.role === "renter" && l.capacity <= 0),
              )
              .map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg">
              No listings found. Try adjusting your filters.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default ListingsPage;
