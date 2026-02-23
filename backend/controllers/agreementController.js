import { supabase } from "../config/supabase.js";
import { logActivity } from "../utils/auditLog.js";

// Get user agreements
export const getUserAgreements = async (req, res) => {
  try {
    let query = supabase.from("agreements").select(`
        *,
        rent_status,
        due_date,
        end_date,
        listing:listings(*),
        owner:users!owner_id(id, full_name, email, phone, profile_picture, verified),
        renter:users!renter_id(id, full_name, email, phone, profile_picture, verified)
      `);

    if (req.user.role === "owner") {
      query = query.eq("owner_id", req.user.id);
    } else {
      query = query.eq("renter_id", req.user.id);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Get agreements error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create agreement (renter requests an agreement)
export const createAgreement = async (req, res) => {
  try {
    const { listingId, terms } = req.body;

    // Validate listing exists and is approved
    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select("id, owner_id, verified, status")
      .eq("id", listingId)
      .single();

    if (listingError || !listingData) {
      return res.status(400).json({ message: "Invalid listing" });
    }

    const isApproved =
      listingData &&
      (listingData.status === "approved" || listingData.verified === true);
    if (!isApproved) {
      return res.status(400).json({ message: "Listing is not approved yet" });
    }

    // Prevent duplicate agreements for same listing and renter
    const { data: existing } = await supabase
      .from("agreements")
      .select("*")
      .eq("listing_id", listingId)
      .eq("renter_id", req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({
        message: "You have already requested an agreement for this listing",
      });
    }

    const { data, error } = await supabase
      .from("agreements")
      .insert([
        {
          listing_id: listingId,
          owner_id: listingData.owner_id,
          renter_id: req.user.id,
          status: "pending",
          terms: terms || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: "Agreement requested", agreement: data });
  } catch (error) {
    console.error("Create agreement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Confirm agreement
export const confirmAgreement = async (req, res) => {
  try {
    const { id } = req.params;

    // Mark agreement as confirmed
    const { data: agreement, error: updateErr } = await supabase
      .from("agreements")
      .update({ status: "confirmed" })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Decrease available capacity for the related listing by 1 (never below 0)
    let updatedListing = null;
    try {
      const listingId = agreement.listing_id;
      if (listingId) {
        const { data: listingRow, error: listingErr } = await supabase
          .from("listings")
          .select("capacity")
          .eq("id", listingId)
          .single();

        if (
          !listingErr &&
          listingRow &&
          typeof listingRow.capacity === "number"
        ) {
          const newCapacity = Math.max(0, listingRow.capacity - 1);
          const { data: updated, error: capErr } = await supabase
            .from("listings")
            .update({ capacity: newCapacity })
            .eq("id", listingId)
            .select()
            .single();
          if (capErr) {
            console.warn("Failed to decrement listing capacity", capErr);
          } else {
            updatedListing = updated;
          }
        } else {
          // attempt to fetch full listing if we couldn't read capacity
          const { data: fetched } = await supabase
            .from("listings")
            .select("*")
            .eq("id", listingId)
            .single();
          updatedListing = fetched || null;
        }
      }
    } catch (e) {
      console.error(
        "Error decrementing listing capacity after agreement confirm:",
        e,
      );
    }

    res.json({
      message: "Agreement confirmed successfully",
      agreement,
      listing: updatedListing,
    });
  } catch (error) {
    console.error("Confirm agreement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Cancel agreement
export const cancelAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from("agreements")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: "Agreement cancelled successfully",
      agreement: data,
    });
  } catch (error) {
    console.error("Cancel agreement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update rent status and optionally due/end dates (owner or admin action)
export const updateRentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { rent_status, due_date, end_date, start_date } = req.body;

    // ensure owner can only modify their own agreements
    if (req.user.role === "owner") {
      const { data: existing, error: fetchErr } = await supabase
        .from("agreements")
        .select("owner_id")
        .eq("id", id)
        .single();
      if (fetchErr || !existing) {
        return res.status(404).json({ message: "Agreement not found" });
      }
      if (existing.owner_id !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
    }

    // only allow valid statuses
    const validStatuses = ["due", "paid", "cancelled"];
    if (rent_status && !validStatuses.includes(rent_status)) {
      return res.status(400).json({ message: "Invalid rent_status" });
    }

    const updateData = {};
    if (rent_status) updateData.rent_status = rent_status;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    // allow owner to manually set renter start date
    if (start_date !== undefined) {
      updateData.renter_confirmed_at = start_date;
    }

    const { data, error } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Rent status updated", agreement: data });
  } catch (error) {
    console.error("Update rent status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all agreements (admin only)
export const getAllAgreements = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agreements")
      .select(
        `
        *,
        rent_status,
        due_date,
        end_date,
        listing:listings(*),
        owner:users!owner_id(id, full_name, email, phone, profile_picture, verified),
        renter:users!renter_id(id, full_name, email, phone, profile_picture, verified)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Get all agreements error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get agreements for a specific listing (owner or admin)
export const getAgreementsByListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    let query = supabase.from("agreements").select(`
        *,
        rent_status,
        due_date,
        end_date,
        listing:listings(*),
        owner:users!owner_id(id, full_name, email, phone, profile_picture, verified),
        renter:users!renter_id(id, full_name, email, phone, profile_picture, verified)
      `);

    // if owner, restrict to agreements belonging to that owner
    if (req.user.role === "owner") {
      query = query.eq("owner_id", req.user.id);
    }
    query = query.eq("listing_id", listingId);

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Get agreements by listing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Produce rent status summary for admin
export const getRentSummary = async (req, res) => {
  try {
    // fetch all agreements with statuses and update timestamps
    const { data, error } = await supabase
      .from("agreements")
      .select("rent_status, updated_at");

    if (error) throw error;

    const daily = {};
    const monthly = {};

    data.forEach(({ rent_status, updated_at }) => {
      const dt = new Date(updated_at);
      if (isNaN(dt)) return;
      const date = dt.toISOString().split("T")[0]; // yyyy-mm-dd
      const month = date.slice(0, 7); // yyyy-mm

      const ensure = (obj, key) => {
        if (!obj[key]) {
          obj[key] = { paid: 0, due: 0, cancelled: 0 };
        }
        return obj[key];
      };

      ensure(daily, date)[rent_status]++;
      ensure(monthly, month)[rent_status]++;
    });

    res.json({ daily, monthly });
  } catch (error) {
    console.error("Get rent summary error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Renter confirms agreement
export const renterConfirmAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: agr, error: fetchErr } = await supabase
      .from("agreements")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !agr)
      return res.status(404).json({ message: "Agreement not found" });
    if (agr.renter_id !== req.user.id)
      return res.status(403).json({ message: "Permission denied" });

    const oldStatus = agr.status;
    const updateData = { renter_confirmed_at: new Date().toISOString() };
    if (agr.owner_confirmed_at) updateData.status = "confirmed";

    const { data: updated, error } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await logActivity(
      "agreement",
      id,
      "confirmed_by_renter",
      oldStatus,
      updated.status,
      req.user.id,
    );
    res.json({
      message:
        updated.status === "confirmed"
          ? "Agreement confirmed!"
          : "Waiting for owner",
      agreement: updated,
    });
  } catch (error) {
    console.error("Renter confirm agreement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Owner confirms agreement
export const ownerConfirmAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: agr, error: fetchErr } = await supabase
      .from("agreements")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !agr)
      return res.status(404).json({ message: "Agreement not found" });
    if (agr.owner_id !== req.user.id)
      return res.status(403).json({ message: "Permission denied" });

    const oldStatus = agr.status;
    const updateData = { owner_confirmed_at: new Date().toISOString() };
    if (agr.renter_confirmed_at) updateData.status = "confirmed";

    const { data: updated, error } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await logActivity(
      "agreement",
      id,
      "confirmed_by_owner",
      oldStatus,
      updated.status,
      req.user.id,
    );
    res.json({
      message:
        updated.status === "confirmed"
          ? "Agreement confirmed!"
          : "Waiting for renter",
      agreement: updated,
    });
  } catch (error) {
    console.error("Owner confirm agreement error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get activity log for agreement
export const getAgreementActivityLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: agr } = await supabase
      .from("agreements")
      .select("owner_id,renter_id")
      .eq("id", id)
      .single();
    if (
      !agr ||
      (req.user.role !== "admin" &&
        req.user.id !== agr.owner_id &&
        req.user.id !== agr.renter_id)
    )
      return res.status(403).json({ message: "Permission denied" });

    const { data, error } = await supabase
      .from("activity_logs")
      .select(`*,changed_by_user:users!changed_by(id,full_name,email,role)`)
      .eq("entity_type", "agreement")
      .eq("entity_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Get activity log error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
