import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { supabase } from "../config/supabase.js";

const AVATAR_BUCKET = "avatars";
const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;

const ensureAvatarBucket = async () => {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = Array.isArray(buckets)
    ? buckets.some((bucket) => bucket.name === AVATAR_BUCKET)
    : false;

  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(
      AVATAR_BUCKET,
      {
        public: true,
        fileSizeLimit: AVATAR_MAX_FILE_SIZE,
      },
    );

    if (createError) {
      throw createError;
    }
  }
};

// Register new user
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, phone, role, idType, idNumber } =
      req.body;

    if (role === "admin") {
      return res.status(403).json({
        message: "Administrator accounts cannot be self-registered",
      });
    }

    // Check if user already exists
    // Use maybeSingle() to avoid Supabase raising an error when no row is found
    const { data: existingUser, error: existingErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingErr) {
      // unexpected DB error
      console.error("Error checking existing user:", existingErr);
      return res.status(500).json({ message: "Server error checking user" });
    }

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Additional validation: require ID info for renter/owner
    if ((role === "renter" || role === "owner") && (!idType || !idNumber)) {
      return res.status(400).json({
        message: "ID type and ID number are required for verification",
      });
    }

    // If role requires ID image, enforce presence of an uploaded file
    if ((role === "renter" || role === "owner") && !req.file) {
      return res
        .status(400)
        .json({ message: "Please upload an image of your ID" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from("users")
      .insert([
        {
          email,
          password: hashedPassword,
          full_name: fullName,
          phone,
          role,
          id_type: idType || null,
          id_number: idNumber || null,
          verified: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // If an ID image file was included during registration, upload it to the 'ids' bucket
    if (req.file) {
      try {
        // validate mimetype/size already handled by multer config in route
        let fileName = req.file.originalname || "id_image.jpg";
        fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const idPath = `ids/${newUser.id}/${Date.now()}_${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from("ids")
          .upload(idPath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: publicData } = await supabase.storage
            .from("ids")
            .getPublicUrl(idPath);
          const publicUrl =
            publicData?.publicUrl || publicData?.publicURL || null;

          // update user with id image info
          await supabase
            .from("users")
            .update({ id_image: publicUrl, id_image_path: idPath })
            .eq("id", newUser.id);
        } else {
          console.warn("ID image upload failed: ", uploadErr);
        }
      } catch (e) {
        console.error("Error uploading ID image during registration:", e);
      }
    }

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Get user
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        verified: user.verified,
        profilePicture: user.profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

// Forgot password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // In production, send email with reset link
    // For now, just return success
    res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token and update password
    // Implementation depends on your token strategy
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, email, full_name, phone, role, verified, profile_picture, id_type, id_number, id_image, created_at",
      )
      .eq("id", req.user.id)
      .single();

    if (error) throw error;

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      role: user.role,
      verified: user.verified,
      profilePicture: user.profile_picture || null,
      idType: user.id_type || null,
      idNumber: user.id_number || null,
      idImage: user.id_image || null,
      createdAt: user.created_at || null,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update current user profile (full name, phone, email)
export const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, email } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Email is required" });
      }

      const { data: existingUser, error: existingErr } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .neq("id", req.user.id)
        .maybeSingle();

      if (existingErr) throw existingErr;
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use" });
      }

      updates.email = normalizedEmail;
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", req.user.id)
      .select("id, email, full_name, phone, role, verified, profile_picture")
      .single();

    if (error) throw error;

    res.json({
      message: "Profile updated",
      user: {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        phone: data.phone,
        role: data.role,
        verified: data.verified,
        profilePicture: data.profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload avatar (base64 image) and save public URL to user profile
export const uploadAvatar = async (req, res) => {
  try {
    const { imageBase64, fileName } = req.body;
    if (!imageBase64 || !fileName) {
      return res
        .status(400)
        .json({ message: "imageBase64 and fileName are required" });
    }

    // Decode base64 (supports raw base64 and data URL format)
    const base64Payload = imageBase64.includes(",")
      ? imageBase64.split(",").pop()
      : imageBase64;
    const buffer = Buffer.from(base64Payload, "base64");
    const path = `avatars/${req.user.id}/${Date.now()}_${fileName}`;

    await ensureAvatarBucket();

    // Upload to Supabase Storage (bucket: avatars)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = await supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);

    const publicUrl = publicData?.publicUrl || publicData?.publicURL || null;

    // Save to user profile
    const { data, error } = await supabase
      .from("users")
      .update({ profile_picture: publicUrl })
      .eq("id", req.user.id)
      .select("id, email, full_name, phone, role, verified, profile_picture")
      .single();

    if (error) throw error;

    res.json({
      message: "Avatar uploaded",
      user: {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        phone: data.phone,
        role: data.role,
        verified: data.verified,
        profilePicture: data.profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({
      message: error?.message || "Failed to upload avatar",
    });
  }
};

// Upload avatar via multipart/form-data with validation
export const uploadAvatarMultipart = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const MAX_FILE_SIZE = AVATAR_MAX_FILE_SIZE;
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 5MB limit" });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ message: "Only JPEG, PNG, and WebP images are allowed" });
    }

    // Sanitize fileName
    let fileName = req.file.originalname;
    fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!fileName) fileName = "avatar.jpg";

    const path = `avatars/${req.user.id}/${Date.now()}_${fileName}`;

    await ensureAvatarBucket();

    // Upload to Supabase Storage (bucket: avatars)
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = await supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || publicData?.publicURL || null;

    // Save to user profile
    const { data, error } = await supabase
      .from("users")
      .update({ profile_picture: publicUrl })
      .eq("id", req.user.id)
      .select("id, email, full_name, phone, role, verified, profile_picture")
      .single();

    if (error) throw error;

    res.json({
      message: "Avatar uploaded successfully",
      user: {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        phone: data.phone,
        role: data.role,
        verified: data.verified,
        profilePicture: data.profile_picture || null,
      },
    });
  } catch (error) {
    console.error("Upload avatar multipart error:", error);
    res.status(500).json({
      message: error?.message || "Failed to upload avatar",
    });
  }
};

// Verify email and phone for password reset
export const verifyAccountForPasswordReset = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: "Email and phone are required" });
    }

    // Search for user by email and phone
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name, phone, role")
      .eq("email", email.toLowerCase().trim())
      .eq("phone", phone.trim())
      .maybeSingle();

    if (error) {
      console.error("Verify account error:", error);
      throw error;
    }

    if (!user) {
      return res.status(404).json({
        message: "The email/phone number is not in the list",
      });
    }

    // Return user details for confirmation
    res.json({
      message: "Account verified",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify account for password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Request password reset (after email+phone verification)
export const requestPasswordReset = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({
        message: "User ID and new password are required",
      });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Create password reset request (pending admin approval)
    const { data: resetRequest, error: resetError } = await supabase
      .from("password_reset_requests")
      .insert([
        {
          user_id: userId,
          new_password: hashedPassword,
          status: "pending",
          verified_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (resetError) throw resetError;

    res.json({
      message:
        "Password reset request submitted. Waiting for admin verification.",
      requestId: resetRequest.id,
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Get all password reset requests
export const getPendingPasswordResets = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { data: resetRequests, error } = await supabase
      .from("password_reset_requests")
      .select(
        `
        id,
        user_id,
        status,
        verified_at,
        approved_at,
        rejection_reason,
        created_at
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = Array.from(
      new Set(
        (resetRequests || []).map((request) => request.user_id).filter(Boolean),
      ),
    );

    let userById = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, email, full_name, phone, role")
        .in("id", userIds);

      if (usersError) throw usersError;

      userById = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
    }

    const requestsWithUsers = (resetRequests || []).map((request) => ({
      ...request,
      users: userById[request.user_id] || null,
    }));

    res.json({
      message: "Password reset requests retrieved",
      requests: requestsWithUsers,
    });
  } catch (error) {
    console.error("Get pending password resets error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Approve password reset request
export const approvePasswordReset = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { resetRequestId } = req.body;

    if (!resetRequestId) {
      return res.status(400).json({ message: "Reset request ID is required" });
    }

    // Get the reset request
    const { data: resetRequest, error: fetchError } = await supabase
      .from("password_reset_requests")
      .select("*")
      .eq("id", resetRequestId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!resetRequest) {
      return res.status(404).json({ message: "Reset request not found" });
    }

    // Update user password and mark request as approved
    const { error: updateError } = await supabase
      .from("users")
      .update({ password: resetRequest.new_password })
      .eq("id", resetRequest.user_id);

    if (updateError) throw updateError;

    // Mark reset request as approved
    const { error: approveError } = await supabase
      .from("password_reset_requests")
      .update({
        status: "approved",
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", resetRequestId);

    if (approveError) throw approveError;

    res.json({
      message: "Password reset approved successfully",
    });
  } catch (error) {
    console.error("Approve password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin: Reject password reset request
export const rejectPasswordReset = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { resetRequestId, rejectionReason } = req.body;

    if (!resetRequestId) {
      return res.status(400).json({ message: "Reset request ID is required" });
    }

    // Mark reset request as rejected
    const { error } = await supabase
      .from("password_reset_requests")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason || "Rejected by admin",
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", resetRequestId)
      .eq("status", "pending");

    if (error) throw error;

    res.json({
      message: "Password reset request rejected",
    });
  } catch (error) {
    console.error("Reject password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
