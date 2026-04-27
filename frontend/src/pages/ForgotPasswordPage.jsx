import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  Lock,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { authService } from "../services/api";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";

const ForgotPasswordPage = () => {
  const [step, setStep] = useState("verify"); // verify -> confirm -> success
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [resetRequestId, setResetRequestId] = useState("");

  const handleVerifyAccount = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authService.verifyAccountForPasswordReset(
        email,
        phone,
      );

      if (response.user) {
        setVerifiedUser(response.user);
        setStep("confirm");
        toast.success("Account verified! Now set your new password.");
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || "Failed to verify account";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!newPassword || !confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await authService.requestPasswordReset(
        verifiedUser.id,
        newPassword,
      );

      if (response.requestId) {
        setResetRequestId(response.requestId);
        setStep("success");
        toast.success("Password reset request submitted!");
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || "Failed to submit password reset";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToVerify = () => {
    setStep("verify");
    setVerifiedUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <div className="card p-8">
            {/* Step 1: Verify Account */}
            {step === "verify" && (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <Lock className="h-8 w-8 text-primary-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Reset Password
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Verify your account to proceed
                  </p>
                </div>

                {error && (
                  <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyAccount} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field pl-10"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input-field pl-10"
                        placeholder="+63 0912 345 6789"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the phone number registered with your account
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Verifying..." : "Verify Account"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Login
                  </Link>
                </div>
              </>
            )}

            {/* Step 2: Set New Password */}
            {step === "confirm" && verifiedUser && (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <Lock className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Confirm Your Account
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Update your password for this account
                  </p>
                </div>

                {/* Account Details Display */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Account Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium text-gray-700">Name:</span>
                      <span className="text-gray-600 ml-2">
                        {verifiedUser.fullName || "N/A"}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="text-gray-600 ml-2">
                        {verifiedUser.email}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Phone:</span>
                      <span className="text-gray-600 ml-2">
                        {verifiedUser.phone}
                      </span>
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Role:</span>
                      <span className="text-gray-600 ml-2 capitalize">
                        {verifiedUser.role}
                      </span>
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field pl-10"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 6 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field pl-10"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Submitting..." : "Reset Password"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={handleBackToVerify}
                    className="inline-flex items-center text-gray-600 hover:text-gray-700"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </button>
                </div>
              </>
            )}

            {/* Step 3: Success Message */}
            {step === "success" && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Password Reset Submitted
                </h2>
                <p className="text-gray-600 mb-4">
                  Your password reset request has been submitted successfully.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-900">
                    <strong>Waiting for admin verification</strong>
                  </p>
                  <p className="text-xs text-blue-800 mt-2">
                    An administrator will review your request. You will be
                    notified once your password has been reset. This usually
                    takes within 24 hours.
                  </p>
                </div>
                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="w-full btn-primary text-center inline-block"
                  >
                    Back to Login
                  </Link>
                  <Link
                    to="/"
                    className="w-full btn-outline text-center inline-block"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
