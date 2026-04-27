import { supabase } from "../config/supabase.js";
import { logActivity } from "../utils/auditLog.js";

// Create application
export const createApplication = async (req, res) => {
  try {
    const { listingId, message } = req.body;

    // Ensure listing is approved before allowing applications
    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .select("id, verified, status")
      .eq("id", listingId)
      .single();

    if (listingError) {
      console.error("Listing lookup error:", listingError);
      return res.status(400).json({ message: "Invalid listing" });
    }

    const isApproved =
      listingData &&
      (listingData.status === "approved" || listingData.verified === true);
    if (!isApproved) {
      return res.status(400).json({ message: "Listing is not approved yet" });
    }

    // Check if already applied (allow if previous application was cancelled by renter only)
    const { data: existing } = await supabase
      .from("applications")
      .select("*")
      .eq("listing_id", listingId)
      .eq("applicant_id", req.user.id)
      .neq("status", "cancelled")
      .single();

    if (existing) {
      return res
        .status(400)
        .json({ message: "You have already applied to this listing" });
    }

    // Check if previous application was cancelled by owner (if so, prevent re-application)
    const { data: prevCancelled } = await supabase
      .from("applications")
      .select("*")
      .eq("listing_id", listingId)
      .eq("applicant_id", req.user.id)
      .eq("status", "cancelled")
      .neq("cancelled_by", req.user.id)
      .single();

    if (prevCancelled) {
      return res
        .status(400)
        .json({ message: "You cannot re-apply to this listing as the owner has cancelled your previous application" });
    }

    const { data, error } = await supabase
      .from("applications")
      .insert([
        {
          listing_id: listingId,
          applicant_id: req.user.id,
          message,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Application submitted successfully",
      application: data,
    });
  } catch (error) {
    console.error("Create application error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get user applications
export const getUserApplications = async (req, res) => {
  try {
    let query;

    if (req.user.role === "owner") {
      // Get applications for owner's listings
      query = supabase
        .from("applications")
        .select(
          `
          *,
          listing:listings(*),
          applicant:users!applicant_id(id, full_name, email, phone, profile_picture, id_type, id_number, id_image, verified, created_at)
        `,
        )
        .eq("listings.owner_id", req.user.id);
    } else {
      // Get applications by renter
      query = supabase
        .from("applications")
        .select(
          `
          *,
          listing:listings(*)
        `,
        )
        .eq("applicant_id", req.user.id);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update application status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // If accepted, create agreement
    if (status === "accepted") {
      const { data: application } = await supabase
        .from("applications")
        .select("*, listing:listings(owner_id, price)")
        .eq("id", id)
        .single();

      await supabase.from("agreements").insert([
        {
          listing_id: application.listing_id,
          owner_id: application.listing.owner_id,
          renter_id: application.applicant_id,
          status: "pending",
        },
      ]);
    }

    res.json({
      message: "Application status updated",
      application: data,
    });
  } catch (error) {
    console.error("Update application error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get renters for a specific listing (for owner to view applications)
export const getRentersByListing = async (req, res) => {
  try {
    const { listingId } = req.params;

    // First verify the listing belongs to the owner making the request
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("owner_id")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Only allow owner to view renters for their listing
    if (listing.owner_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only view renters for your own listings" });
    }

    // Get all applications for this listing with applicant details
    const { data: apps, error } = await supabase
      .from("applications")
      .select(
        `
        id,
        status,
        created_at,
        applicant:users!applicant_id(id, full_name, email, phone, profile_picture, verified)
      `,
      )
      .eq("listing_id", listingId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map applications to renter-like objects for the frontend
    const renters = apps.map((a) => {
      const renterData = Array.isArray(a.applicant)
        ? a.applicant[0]
        : a.applicant;
      return {
        id: renterData?.id,
        full_name: renterData?.full_name,
        email: renterData?.email,
        phone: renterData?.phone,
        profile_picture: renterData?.profile_picture,
        verified: renterData?.verified,
        applicationStatus: a.status,
        applicationDate: a.created_at,
        applicationId: a.id,
      };
    });

    res.json(renters);
  } catch (error) {
    console.error("Get renters error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Renter confirms application (creates or updates agreement)
export const confirmApplication = async (req, res) => {
  try {
    const { id } = req.params;

    // Get application
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("*, listing:listings(owner_id, price)")
      .eq("id", id)
      .single();

    if (appError || !application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Only renter can confirm their own application
    if (application.applicant_id !== req.user.id) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Check if agreement already exists
    const { data: existingAgreement } = await supabase
      .from("agreements")
      .select("id, status")
      .eq("listing_id", application.listing_id)
      .eq("renter_id", req.user.id)
      .eq("owner_id", application.listing.owner_id)
      .single();

    let agreement;
    if (existingAgreement) {
      // Update existing agreement
      const { data: updated, error } = await supabase
        .from("agreements")
        .update({ status: "pending_owner" })
        .eq("id", existingAgreement.id)
        .select()
        .single();
      if (error) throw error;
      agreement = updated;
    } else {
      // Create new agreement with pending_owner status
      const { data: created, error } = await supabase
        .from("agreements")
        .insert([
          {
            listing_id: application.listing_id,
            owner_id: application.listing.owner_id,
            renter_id: req.user.id,
            status: "pending_owner",
          },
        ])
        .select()
        .single();
      if (error) throw error;
      agreement = created;
    }

    // Log activity
    await logActivity(
      "application",
      id,
      "confirmed_by_renter",
      "pending",
      "pending",
      req.user.id,
      { agreementId: agreement.id },
    );

    res.json({
      message: "Application confirmed. Waiting for owner approval.",
      application,
      agreement,
    });
  } catch (error) {
    console.error("Confirm application error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Renter cancels application
export const cancelApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get application
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .single();

    if (appError || !application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Only renter can cancel their own application
    if (application.applicant_id !== req.user.id) {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Update application status and track who cancelled
    const { data: updated, error } = await supabase
      .from("applications")
      .update({ status: "cancelled", cancelled_by: req.user.id })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Also cancel any pending agreements and fetch them
    const { data: cancelledAgreements, error: agreementError } = await supabase
      .from("agreements")
      .update({ status: "cancelled", cancellation_reason: reason, cancelled_by: req.user.id })
      .eq("listing_id", application.listing_id)
      .eq("renter_id", req.user.id)
      .in("status", ["pending", "pending_owner", "pending_renter"])
      .select();

    // Log activity
    await logActivity(
      "application",
      id,
      "cancelled_by_renter",
      "pending",
      "cancelled",
      req.user.id,
      { reason },
    );

    res.json({
      message: "Application cancelled",
      application: updated,
      agreementsCancelled: cancelledAgreements || [],
    });
  } catch (error) {
    console.error("Cancel application error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
