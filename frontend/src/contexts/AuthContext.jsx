import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on mount
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await authService.getProfile();
      // server returns user object shape matching getCurrentUser
      if (data) {
        const serverUser = {
          id: data.id,
          email: data.email,
          fullName: data.fullName || data.full_name || null,
          phone: data.phone,
          role: data.role,
          verified: data.verified,
          profilePicture: data.profilePicture || data.profile_picture || null,
        };
        setUser(serverUser);
        localStorage.setItem("user", JSON.stringify(serverUser));
      }
    } catch (err) {
      console.error("Failed to refresh user", err);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    refreshUser,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
