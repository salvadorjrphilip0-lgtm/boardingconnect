import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, MapPin, Users, FileText, PlusCircle } from "lucide-react";
import { listingService } from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import OwnerSidebar from "../components/OwnerSidebar";

const CreateListingPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    price: "",
    capacity: "",
    amenities: [],
    images: [],
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const availableAmenities = [
    "WiFi",
    "Air Conditioning",
    "Parking",
    "Kitchen",
    "Laundry",
    "Security",
    "Water Supply",
    "Electricity",
    "Furnished",
    "Cable TV",
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If there are image files, upload them first and collect URLs + paths
      let images = formData.images || [];
      let images_paths = [];

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const res = await listingService.uploadImage(file);
            console.log("Upload response:", res);

            // Collect public URL if available
            if (res && res.url) {
              images.push(res.url);
              console.log("Added image URL:", res.url);
            }

            // Also collect storage path as fallback
            if (res && res.path) {
              images_paths.push(res.path);
              console.log("Added image path:", res.path);
            }
          } catch (err) {
            console.error("Image upload failed for", file.name, err);
            // continue uploading other images
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      }

      console.log(
        "Creating listing with images:",
        images,
        "paths:",
        images_paths,
      );

      // Create listing on server with both images and paths
      const result = await listingService.create({
        ...formData,
        images,
        images_paths,
      });
      toast.success("Listing created successfully!");

      // Navigate to newly created listing details so owner can see uploaded images
      const newId = result?.listing?.id || result?.id;
      if (newId) {
        // Pass previews / uploaded image URLs in navigation state so the
        // listing details page can display images immediately while the
        // server-side record is loading.
        const imageFallbacks = images.length > 0 ? images : previews;
        navigate(`/listings/${newId}`, { state: { previews: imageFallbacks } });
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Create listing error:", error);
      toast.error(error.response?.data?.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <OwnerSidebar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Create New Listing
          </h1>
          <p className="text-gray-600 mt-2">
            Fill in the details about your boarding house
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing Title *
            </label>
            <div className="relative">
              <Home className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="input-field pl-10"
                placeholder="e.g., Cozy Boarding House near USTP"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className="input-field"
              placeholder="Describe your boarding house..."
              required
            ></textarea>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="input-field pl-10"
                placeholder="e.g., Alubijid, Misamis Oriental"
                required
              />
            </div>
          </div>

          {/* Price and Capacity */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monthly Price (₱) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  ₱
                </span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="3000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Slots *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Amenities
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableAmenities.map((amenity) => (
                <label
                  key={amenity}
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.amenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{amenity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700"
            />

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`preview-${idx}`}
                    className="h-24 w-full object-cover rounded"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Listing"}
            </button>
          </div>
        </form>
      </div>

      <Footer />
    </div>
  );
};

export default CreateListingPage;
