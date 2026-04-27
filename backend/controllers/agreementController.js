import { supabase } from "../config/supabase.js";
import { logActivity } from "../utils/auditLog.js";

const parseAgreementTerms = (terms) => {
  if (!terms) return {};
  try {
    const parsed = JSON.parse(terms);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

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

    const listingIds = (data || [])
      .map((agreement) => agreement?.listing?.id)
      .filter(Boolean);

    let ratingSummaryByListing = {};

    if (listingIds.length > 0) {
      const { data: reviewRows, error: reviewsError } = await supabase
        .from("reviews")
        .select("listing_id, rating")
        .in("listing_id", listingIds);

      if (reviewsError) throw reviewsError;

      ratingSummaryByListing = (reviewRows || []).reduce((acc, review) => {
        const listingId = review.listing_id;
        const rating = Number(review.rating) || 0;

        if (!acc[listingId]) {
          acc[listingId] = { totalRatings: 0, ratingTotal: 0 };
        }

        acc[listingId].totalRatings += 1;
        acc[listingId].ratingTotal += rating;
        return acc;
      }, {});
    }

    const agreementsWithListingRatings = (data || []).map((agreement) => {
      if (!agreement?.listing) return agreement;

      const listingId = agreement.listing.id;
      const totalRatings = ratingSummaryByListing[listingId]?.totalRatings || 0;
      const ratingTotal = ratingSummaryByListing[listingId]?.ratingTotal || 0;

      return {
        ...agreement,
        listing: {
          ...agreement.listing,
          totalRatings,
          averageRating:
            totalRatings > 0
              ? Number((ratingTotal / totalRatings).toFixed(1))
              : 0,
        },
      };
    });

    res.json(agreementsWithListingRatings);
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

    // Prevent duplicate agreements for same listing and renter (unless previous one is cancelled)
    const { data: existing } = await supabase
      .from("agreements")
      .select("*")
      .eq("listing_id", listingId)
      .eq("renter_id", req.user.id)
      .neq("status", "cancelled")
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

    // Get agreement details first to find related application
    const { data: agreement, error: fetchErr } = await supabase
      .from("agreements")
      .select("id, listing_id, renter_id, owner_id")
      .eq("id", id)
      .single();

    if (fetchErr || !agreement) {
      return res.status(400).json({ message: "Agreement not found" });
    }

    // Check if user is authorized to cancel (owner or renter)
    const isOwner = agreement.owner_id === req.user.id;
    const isRenter = agreement.renter_id === req.user.id;

    if (!isOwner && !isRenter) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Update agreement status and track who cancelled
    const { data, error } = await supabase
      .from("agreements")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_by: req.user.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Also cancel the related application to maintain consistency
    const { error: appError } = await supabase
      .from("applications")
      .update({ status: "cancelled", cancelled_by: req.user.id })
      .eq("listing_id", agreement.listing_id)
      .eq("applicant_id", agreement.renter_id);

    if (appError) {
      console.warn("Failed to update application status:", appError);
      // Don't fail the entire operation, just log the warning
    }

    // Log the cancellation
    const cancelledBy = isOwner ? "owner" : "renter";
    await logActivity(
      "agreement",
      id,
      `cancelled_by_${cancelledBy}`,
      "pending",
      "cancelled",
      req.user.id,
      { reason },
    );

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
    const {
      rent_status,
      due_date,
      end_date,
      contract_date,
      start_date,
      payment_amount,
    } = req.body;

    const agreementFields = "id, owner_id, listing_id, renter_id, terms";
    const { data: existingAgreement, error: existingErr } = await supabase
      .from("agreements")
      .select(agreementFields)
      .eq("id", id)
      .single();

    if (existingErr || !existingAgreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    // ensure owner can only modify their own agreements
    if (req.user.role === "owner") {
      if (existingAgreement.owner_id !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
    }

    // only allow valid statuses
    const validStatuses = ["due", "paid", "cancelled"];
    if (rent_status && !validStatuses.includes(rent_status)) {
      return res.status(400).json({ message: "Invalid rent_status" });
    }

    let normalizedPaymentAmount;
    let derivedPaymentType;
    let listingPriceForRecord = 0;
    if (
      payment_amount !== undefined &&
      payment_amount !== null &&
      payment_amount !== ""
    ) {
      normalizedPaymentAmount = Number(payment_amount);
      if (
        !Number.isFinite(normalizedPaymentAmount) ||
        normalizedPaymentAmount < 0
      ) {
        return res.status(400).json({ message: "Invalid payment_amount" });
      }
    }

    const updateData = {};
    if (rent_status) updateData.rent_status = rent_status;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (contract_date !== undefined) updateData.end_date = contract_date;
    // allow owner to manually set renter start date
    if (start_date !== undefined) {
      updateData.renter_confirmed_at = start_date;
    }

    if (normalizedPaymentAmount !== undefined) {
      const { data: listing, error: listingErr } = await supabase
        .from("listings")
        .select("price")
        .eq("id", existingAgreement.listing_id)
        .single();

      if (listingErr || !listing) {
        return res.status(400).json({ message: "Related listing not found" });
      }

      const listingPrice = Number(listing.price) || 0;
      listingPriceForRecord = listingPrice;
      // DB rent_status supports due/paid/cancelled only.
      // Partial is represented via payment metadata; UI derives the "partial" badge.
      updateData.rent_status =
        listingPrice > 0 && normalizedPaymentAmount >= listingPrice
          ? "paid"
          : "due";

      const existingTerms = parseAgreementTerms(existingAgreement.terms);
      const derivedPaymentStatus =
        normalizedPaymentAmount <= 0
          ? "unpaid"
          : listingPrice > 0 && normalizedPaymentAmount < listingPrice
            ? "partial"
            : "paid";
      derivedPaymentType = derivedPaymentStatus;

      const updatedTerms = {
        ...existingTerms,
        payment_amount: normalizedPaymentAmount,
        payment_status: derivedPaymentStatus,
      };

      updateData.terms = JSON.stringify(updatedTerms);
    }

    const { data, error } = await supabase
      .from("agreements")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (normalizedPaymentAmount !== undefined) {
      const { error: incomeRecordError } = await supabase
        .from("monthly_income_records")
        .insert([
          {
            agreement_id: existingAgreement.id,
            listing_id: existingAgreement.listing_id,
            owner_id: existingAgreement.owner_id,
            renter_id: existingAgreement.renter_id,
            listing_price: listingPriceForRecord,
            total_payment: normalizedPaymentAmount,
            payment_type: derivedPaymentType || "unpaid",
            recorded_by: req.user.id,
          },
        ]);

      if (incomeRecordError) {
        throw incomeRecordError;
      }
    }

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
      .select("renter_id, rent_status, updated_at");

    if (error) throw error;

    const daily = {};
    const monthly = {};
    const dailyRenters = {};
    const monthlyRenters = {};

    data.forEach(({ rent_status, updated_at }) => {
      const dt = new Date(updated_at);
      if (isNaN(dt)) return;
      const date = dt.toISOString().split("T")[0]; // yyyy-mm-dd
      const month = date.slice(0, 7); // yyyy-mm

      const ensure = (obj, key) => {
        if (!obj[key]) {
          obj[key] = { total_renters: 0, paid: 0, due: 0, cancelled: 0 };
        }
        return obj[key];
      };

      ensure(daily, date)[rent_status]++;
      ensure(monthly, month)[rent_status]++;

      if (!dailyRenters[date]) dailyRenters[date] = new Set();
      if (!monthlyRenters[month]) monthlyRenters[month] = new Set();

      if (renter_id) {
        dailyRenters[date].add(renter_id);
        monthlyRenters[month].add(renter_id);
      }
    });

    Object.keys(daily).forEach((dateKey) => {
      daily[dateKey].total_renters = dailyRenters[dateKey]
        ? dailyRenters[dateKey].size
        : 0;
    });

    Object.keys(monthly).forEach((monthKey) => {
      monthly[monthKey].total_renters = monthlyRenters[monthKey]
        ? monthlyRenters[monthKey].size
        : 0;
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
