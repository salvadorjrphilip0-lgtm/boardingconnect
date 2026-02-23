import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import { supabase } from "../config/supabase.js";

// Register new user
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, phone, role, idType, idNumber } =
      req.body;

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
        "id, email, full_name, phone, role, verified, profile_picture, id_type, id_number, id_image",
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
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update current user profile (full name, phone)
export const updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    const updates = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (phone !== undefined) updates.phone = phone;

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

    // Decode base64
    const buffer = Buffer.from(imageBase64, "base64");
    const path = `avatars/${req.user.id}/${Date.now()}_${fileName}`;

    // Upload to Supabase Storage (bucket: avatars)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicData } = await supabase.storage
      .from("avatars")
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
    res.status(500).json({ message: "Server error" });
  }
};

// Upload avatar via multipart/form-data with validation
export const uploadAvatarMultipart = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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

    // Upload to Supabase Storage (bucket: avatars)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = await supabase.storage
      .from("avatars")
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
    res.status(500).json({ message: "Server error" });
  }
};
