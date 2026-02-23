import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Home,
  MessageSquare,
  FileText,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const RenterSidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
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

  const menuItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      path: "/listings",
      label: "Browse Listings",
      icon: Home,
    },
    {
      path: "/messages",
      label: "Messages",
      icon: MessageSquare,
    },
    {
      path: "/applications",
      label: "My Applications",
      icon: FileText,
    },
    {
      path: "/agreements",
      label: "My Agreements",
      icon: FileText,
    },
    {
      path: "/my-boarding",
      label: "My Boarding",
      icon: FileText,
    },
    {
      path: "/concerns",
      label: "My Concerns",
      icon: FileText,
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
          className="fixed top-4 left-4 z-50 md:hidden p-2 bg-white rounded-lg shadow-md"
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
          className="hidden md:block fixed left-0 top-0 w-6 h-screen z-30"
          onMouseEnter={() => setIsVisible(true)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-64 bg-white shadow-lg h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={() => !isMobile && setIsVisible(true)}
        onMouseLeave={() => !isMobile && setIsVisible(false)}
      >
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Renter Panel</h2>
          <p className="text-sm text-gray-600 mt-1">
            Welcome, {user?.fullName}
          </p>
        </div>

        <nav className="flex-1 px-4 py-6">
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

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default RenterSidebar;
