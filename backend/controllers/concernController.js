import { supabase } from "../config/supabase.js";

// Create a concern about a listing
export const createConcern = async (req, res) => {
  try {
    const { listing_id, title, description } = req.body;
    const renter_id = req.user.id;

    // Validate input
    if (!listing_id || !title || !description) {
      return res.status(400).json({
        message: "Listing ID, title, and description are required",
      });
    }

    // Check if listing exists
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Create concern
    const { data, error } = await supabase
      .from("concerns")
      .insert([
        {
          listing_id,
          renter_id,
          title,
          description,
          status: "pending",
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Concern created successfully",
      concern: data[0],
    });
  } catch (error) {
    console.error("Error creating concern:", error);
    res.status(500).json({ message: "Error creating concern" });
  }
};

// Get concerns for a renter (their own concerns)
export const getRenterConcerns = async (req, res) => {
  try {
    const renter_id = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("concerns")
      .select(
        `
        id,
        listing_id,
        renter_id,
        title,
        description,
        status,
        admin_response,
        created_at,
        updated_at,
        listings:listing_id (id, title, address)
      `,
        { count: "exact" }
      )
      .eq("renter_id", renter_id);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      concerns: data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching renter concerns:", error);
    res.status(500).json({ message: "Error fetching concerns" });
  }
};

// Get all concerns (admin only)
export const getAllConcerns = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, listing_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase.from("concerns").select(
      `
        id,
        listing_id,
        renter_id,
        title,
        description,
        status,
        admin_response,
        created_at,
        updated_at,
        users:renter_id (id, full_name, email),
        listings:listing_id (id, title, address, owner_id)
      `,
      { count: "exact" }
    );

    if (status) {
      query = query.eq("status", status);
    }

    if (listing_id) {
      query = query.eq("listing_id", listing_id);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      concerns: data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all concerns:", error);
    res.status(500).json({ message: "Error fetching concerns" });
  }
};

// Respond to a concern (admin only)
export const respondToConcern = async (req, res) => {
  try {
    const { concern_id } = req.params;
    const { admin_response, status } = req.body;

    // Validate input
    if (!admin_response) {
      return res.status(400).json({ message: "Response is required" });
    }

    // Check if concern exists
    const { data: concern, error: concernError } = await supabase
      .from("concerns")
      .select("id")
      .eq("id", concern_id)
      .single();

    if (concernError || !concern) {
      return res.status(404).json({ message: "Concern not found" });
    }

    // Update concern with response
    const { data, error } = await supabase
      .from("concerns")
      .update({
        admin_response,
        status: status || "reviewed",
      })
      .eq("id", concern_id)
      .select();

    if (error) throw error;

    res.json({
      message: "Concern responded to successfully",
      concern: data[0],
    });
  } catch (error) {
    console.error("Error responding to concern:", error);
    res.status(500).json({ message: "Error responding to concern" });
  }
};

// Resolve a concern (admin only)
export const resolveConcern = async (req, res) => {
  try {
    const { concern_id } = req.params;

    // Update concern status to resolved
    const { data, error } = await supabase
      .from("concerns")
      .update({ status: "resolved" })
      .eq("id", concern_id)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ message: "Concern not found" });
    }

    res.json({
      message: "Concern resolved successfully",
      concern: data[0],
    });
  } catch (error) {
    console.error("Error resolving concern:", error);
    res.status(500).json({ message: "Error resolving concern" });
  }
};

// Get concern details
export const getConcernDetail = async (req, res) => {
  try {
    const { concern_id } = req.params;
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("concerns")
      .select(
        `
        id,
        listing_id,
        renter_id,
        title,
        description,
        status,
        admin_response,
        created_at,
        updated_at,
        users:renter_id (id, full_name, email),
        listings:listing_id (id, title, address, owner_id)
      `
      )
      .eq("id", concern_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Concern not found" });
    }

    // Check access: renter can view own concerns, admin can view all
    if (data.renter_id !== user_id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You do not have access to this concern" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching concern details:", error);
    res.status(500).json({ message: "Error fetching concern" });
  }
};
