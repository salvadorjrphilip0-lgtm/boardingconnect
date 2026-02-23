import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";
import RenterSidebar from "../components/RenterSidebar";
import OwnerSidebar from "../components/OwnerSidebar";
import AdminSidebar from "../components/AdminSidebar";

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ fullName: user.fullName || "", phone: user.phone || "" });
      setAvatarPreview(user.profilePicture || null);
    }
  }, [user]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await authService.updateProfile({
        fullName: form.fullName,
        phone: form.phone,
      });
      toast.success(res.message || "Profile updated");
      if (refreshUser) await refreshUser();
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    // Validate MIME type
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    // Use the new multipart endpoint
    authService
      .uploadAvatarMultipart(formData)
      .then((res) => {
        toast.success(res.message || "Avatar uploaded");
        setAvatarPreview(
          res.user?.profilePicture || res.user?.profile_picture || null,
        );
        if (refreshUser) refreshUser();
      })
      .catch(() => {
        toast.error("Failed to upload avatar");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {user?.role === "admin" ? (
        <AdminSidebar />
      ) : user?.role === "owner" ? (
        <OwnerSidebar />
      ) : (
        <RenterSidebar />
      )}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <h2 className="text-2xl font-bold mb-4">My Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500">No photo</div>
                )}
              </div>
              <div className="w-full flex justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="sr-only"
                  />
                  <div className="inline-flex items-center px-3 py-2 rounded-md bg-primary-50 text-primary-700 text-sm font-semibold border border-transparent hover:bg-primary-100 transition">
                    Choose photo
                  </div>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="input-field w-full"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfilePage;
