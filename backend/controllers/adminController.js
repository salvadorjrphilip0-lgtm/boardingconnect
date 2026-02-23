import { supabase } from "../config/supabase.js";

// Get all users
export const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, email, full_name, phone, role, verified, created_at, id_type, id_number, id_image",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify user
export const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("users")
      .update({ verified: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: "User verified successfully",
      user: data,
    });
  } catch (error) {
    console.error("Verify user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) throw error;

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify listing
export const verifyListing = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("listings")
      .update({ verified: true, status: "approved" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: "Listing verified successfully",
      listing: data,
    });
  } catch (error) {
    console.error("Verify listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reject listing (mark as rejected instead of deleting)
export const rejectListing = async (req, res) => {
  try {
    const { id } = req.params;

    // Attempt to fetch images_paths for the listing so we can remove stored files
    try {
      const { data: listingRow, error: fetchErr } = await supabase
        .from("listings")
        .select("images_paths")
        .eq("id", id)
        .single();

      if (
        !fetchErr &&
        listingRow &&
        Array.isArray(listingRow.images_paths) &&
        listingRow.images_paths.length > 0
      ) {
        const { error: remErr } = await supabase.storage
          .from("listings")
          .remove(listingRow.images_paths);
        if (remErr)
          console.warn(
            "Failed to remove listing images from storage during reject",
            remErr,
          );
      }
    } catch (err) {
      console.error("Error removing listing images during reject:", err);
    }

    const rejection_reason = req.body?.rejection_reason || null;

    const { data, error } = await supabase
      .from("listings")
      .update({
        verified: false,
        status: "rejected",
        images: [],
        images_paths: [],
        rejection_reason,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Listing rejected", listing: data });
  } catch (error) {
    console.error("Reject listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
