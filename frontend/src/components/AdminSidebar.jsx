import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  CheckCircle,
  BarChart,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 1024 : true,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsVisible(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const formatPhoneNumber = (value) => {
    if (!value) return "No number";

    const raw = String(value).trim();
    const digits = raw.replace(/\D/g, "");

    if (digits.length === 11 && digits.startsWith("0")) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10 && digits.startsWith("9")) {
      return `0${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    if (digits.length === 12 && digits.startsWith("63")) {
      return `+63 ${digits.slice(2, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`;
    }

    return raw;
  };

  const menuItems = [
    {
      path: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      path: "/reviews",
      label: "Reviews",
      icon: CheckCircle,
    },
    {
      path: "/concerns",
      label: "Concerns",
      icon: FileText,
    },
    {
      path: "/reports",
      label: "Reports",
      icon: BarChart,
    },
    {
      path: "/records",
      label: "Records",
      icon: ClipboardList,
    },
    {
      path: "/profile",
      label: "Profile",
      icon: User,
    },
  ];

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-white rounded-lg shadow-md"
        >
          {isVisible ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsVisible(false)}
        />
      )}

      {/* Desktop trigger area on the left edge */}
      {!isMobile && (
        <div
          className="hidden lg:block fixed left-0 top-0 w-6 h-dvh z-30"
          onMouseEnter={() => setIsVisible(true)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-[85vw] max-w-[320px] sm:w-72 lg:w-64 bg-white shadow-lg h-dvh fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out flex flex-col ${
          isVisible ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={() => !isMobile && setIsVisible(true)}
        onMouseLeave={() => !isMobile && setIsVisible(false)}
      >
        <div className="p-6 border-b text-center">
          <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
          <div className="mt-4 flex justify-center">
            {user?.profilePicture ? (
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                aria-label="Open avatar preview"
              >
                <img
                  src={user.profilePicture}
                  alt={`${user?.fullName || "Admin"} avatar`}
                  className="h-24 w-24 rounded-full object-cover border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer"
                />
              </button>
            ) : (
              <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold">
                {(user?.fullName || "A").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <Link
            to="/profile"
            onClick={() => isMobile && setIsVisible(false)}
            className="text-sm text-primary-700 mt-2 inline-block hover:text-primary-800 hover:underline"
          >
            {user?.fullName}
          </Link>
          <p className="text-xs text-gray-500 mt-1">
            {formatPhoneNumber(user?.phone || user?.phoneNumber)}
          </p>
        </div>

        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => isMobile && setIsVisible(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.path)
                        ? "bg-primary-100 text-primary-700 border-r-4 border-primary-600"
                        : "text-gray-700 hover:bg-gray-100 hover:text-primary-600"
                    }`}
                  >
                    <Icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t bg-white">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {isAvatarModalOpen && user?.profilePicture && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setIsAvatarModalOpen(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(false)}
              className="absolute -top-10 right-0 bg-white rounded-full p-2 shadow"
              aria-label="Close avatar preview"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={user.profilePicture}
              alt={`${user?.fullName || "Admin"} avatar`}
              className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AdminSidebar;
