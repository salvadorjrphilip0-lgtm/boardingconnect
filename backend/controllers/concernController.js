import { supabase } from "../config/supabase.js";

const THREAD_LINE_REGEX = /^\[(ADMIN|RENTER)\]\[(.*?)\]:\s*(.*)$/i;

const parseConcernThread = (threadText) => {
  const raw = String(threadText || "").trim();
  if (!raw) return [];

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];
  let recognizedCount = 0;

  lines.forEach((line) => {
    const match = line.match(THREAD_LINE_REGEX);
    if (match) {
      recognizedCount += 1;
      parsed.push({
        sender: match[1].toLowerCase(),
        timestamp: match[2],
        message: match[3] || "",
      });
    }
  });

  // Backward compatibility: old single admin response string
  if (recognizedCount === 0 && raw) {
    return [
      {
        sender: "admin",
        timestamp: null,
        message: raw,
      },
    ];
  }

  return parsed;
};

const formatThreadLine = (sender, message) => {
  const role = String(sender || "").toUpperCase();
  const timestamp = new Date().toISOString();
  return `[${role}][${timestamp}]: ${(message || "").trim()}`;
};

const appendThreadMessage = (existingThreadText, sender, message) => {
  const newLine = formatThreadLine(sender, message);
  const existing = String(existingThreadText || "").trim();
  if (!existing) return newLine;

  return `${existing}\n${newLine}`;
};

// Create a concern about a listing
export const createConcern = async (req, res) => {
  try {
    const {
      listing_id,
      title,
      reason,
      description,
      full_name,
      email,
      contact_number,
      address,
      boarding_house,
      owner_name,
    } = req.body;
    const renter_id = req.user.id;

    const normalizedReason = (reason || title || "").trim();
    const normalizedDescription = (description || "").trim();
    const normalizedFullName = (full_name || "").trim();
    const normalizedEmail = (email || "").trim();
    const normalizedContactNumber = (contact_number || "").trim();
    const normalizedAddress = (address || "").trim();
    const normalizedBoardingHouse = (boarding_house || "").trim();
    const normalizedOwnerName = (owner_name || "").trim();

    // Validate input
    if (
      !listing_id ||
      !normalizedReason ||
      !normalizedDescription ||
      !normalizedFullName ||
      !normalizedEmail ||
      !normalizedContactNumber ||
      !normalizedAddress ||
      !normalizedBoardingHouse ||
      !normalizedOwnerName
    ) {
      return res.status(400).json({
        message:
          "Full Name, Email, Contact Number, Address, Reason, Description, Boarding House, and Owner Name are required",
      });
    }

    // Check if listing exists
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, title, address, location")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Ensure renter has/rented this boarding house (has an agreement that isn't cancelled)
    const { data: agreement, error: agreementError } = await supabase
      .from("agreements")
      .select("id, status")
      .eq("listing_id", listing_id)
      .eq("renter_id", renter_id)
      .neq("status", "cancelled")
      .maybeSingle();

    if (agreementError) throw agreementError;

    if (!agreement) {
      return res.status(403).json({
        message:
          "You can only submit concerns for boarding houses you are renting",
      });
    }

    const ticketDescription = [
      `Full Name: ${normalizedFullName}`,
      `Email: ${normalizedEmail}`,
      `Contact Number: ${normalizedContactNumber}`,
      `Address: ${normalizedAddress}`,
      `Boarding House: ${normalizedBoardingHouse}`,
      `Owner's Name: ${normalizedOwnerName}`,
      "",
      "Issue Description:",
      normalizedDescription,
    ].join("\n");

    // Create concern
    const { data, error } = await supabase
      .from("concerns")
      .insert([
        {
          listing_id,
          renter_id,
          title: normalizedReason,
          description: ticketDescription,
          status: "pending",
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Concern ticket submitted successfully",
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
    const normalizedStatus = String(status || "")
      .trim()
      .toLowerCase();

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
        { count: "exact" },
      )
      .eq("renter_id", renter_id);

    if (
      normalizedStatus &&
      normalizedStatus !== "all" &&
      ["pending", "reviewed", "resolved"].includes(normalizedStatus)
    ) {
      query = query.eq("status", normalizedStatus);
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
    const normalizedStatus = String(status || "")
      .trim()
      .toLowerCase();

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
      { count: "exact" },
    );

    if (
      normalizedStatus &&
      normalizedStatus !== "all" &&
      ["pending", "reviewed", "resolved"].includes(normalizedStatus)
    ) {
      query = query.eq("status", normalizedStatus);
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
      .select("id, admin_response")
      .eq("id", concern_id)
      .single();

    if (concernError || !concern) {
      return res.status(404).json({ message: "Concern not found" });
    }

    const updatedThread = appendThreadMessage(
      concern.admin_response,
      "admin",
      admin_response,
    );

    // Update concern with response
    const { data, error } = await supabase
      .from("concerns")
      .update({
        admin_response: updatedThread,
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

// Renter replies to an admin response
// Rules:
// 1) Renter can only reply to own concern
// 2) Renter can reply only after at least one admin response
// 3) Renter can only reply once per admin response (must wait for next admin reply)
export const renterReplyToConcern = async (req, res) => {
  try {
    const { concern_id } = req.params;
    const { renter_response } = req.body;
    const renter_id = req.user.id;

    const replyText = String(renter_response || "").trim();
    if (!replyText) {
      return res.status(400).json({ message: "Reply is required" });
    }

    const { data: concern, error: concernError } = await supabase
      .from("concerns")
      .select("id, renter_id, status, admin_response")
      .eq("id", concern_id)
      .single();

    if (concernError || !concern) {
      return res.status(404).json({ message: "Concern not found" });
    }

    if (concern.renter_id !== renter_id) {
      return res
        .status(403)
        .json({ message: "You can only reply to your own concern" });
    }

    if (concern.status === "resolved") {
      return res
        .status(400)
        .json({ message: "Cannot reply to a resolved concern" });
    }

    const thread = parseConcernThread(concern.admin_response);
    const adminCount = thread.filter((item) => item.sender === "admin").length;
    const renterCount = thread.filter(
      (item) => item.sender === "renter",
    ).length;
    const lastSender =
      thread.length > 0 ? thread[thread.length - 1].sender : null;

    if (adminCount === 0) {
      return res.status(400).json({
        message: "Please wait for admin response before replying",
      });
    }

    if (renterCount >= adminCount || lastSender !== "admin") {
      return res.status(400).json({
        message:
          "You already replied. Please wait for the admin to reply again before sending another response",
      });
    }

    const updatedThread = appendThreadMessage(
      concern.admin_response,
      "renter",
      replyText,
    );

    const { data, error } = await supabase
      .from("concerns")
      .update({
        admin_response: updatedThread,
        status: "reviewed",
      })
      .eq("id", concern_id)
      .select();

    if (error) throw error;

    res.json({
      message: "Reply sent successfully",
      concern: data[0],
    });
  } catch (error) {
    console.error("Error sending renter reply:", error);
    res.status(500).json({ message: "Error sending reply" });
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
      `,
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
