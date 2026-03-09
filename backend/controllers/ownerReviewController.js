import { supabase } from "../config/supabase.js";

// Create a review for an owner (separate from listing reviews)
export const createOwnerReview = async (req, res) => {
  try {
    const { owner_id, listing_id, rating, title, comment } = req.body;
    const renter_id = req.user.id;

    if (!owner_id || !listing_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Invalid owner/listing ID or rating (1-5 required)",
      });
    }

    // Ensure owner exists and has owner role
    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("id, role")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner || owner.role !== "owner") {
      return res.status(404).json({ message: "Owner not found" });
    }

    // Ensure listing exists and belongs to owner
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, owner_id")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (listing.owner_id !== owner_id) {
      return res.status(400).json({
        message: "Listing does not belong to this owner",
      });
    }

    // Only allow reviews from renters with confirmed/active agreement
    const { data: agreement, error: agreementError } = await supabase
      .from("agreements")
      .select("id, status")
      .eq("listing_id", listing_id)
      .eq("owner_id", owner_id)
      .eq("renter_id", renter_id)
      .in("status", ["confirmed", "active"])
      .maybeSingle();

    if (agreementError) throw agreementError;

    if (!agreement) {
      return res.status(403).json({
        message: "You can only review an owner after confirming your agreement",
      });
    }

    // Prevent duplicate owner review for same listing by same renter
    const { data: existingOwnerReview } = await supabase
      .from("owner_reviews")
      .select("id")
      .eq("owner_id", owner_id)
      .eq("listing_id", listing_id)
      .eq("renter_id", renter_id)
      .maybeSingle();

    if (existingOwnerReview) {
      return res.status(400).json({
        message: "You have already reviewed this owner for this boarding house",
      });
    }

    const { data, error } = await supabase
      .from("owner_reviews")
      .insert([
        {
          owner_id,
          listing_id,
          renter_id,
          rating,
          title: title || null,
          comment: comment || null,
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: "Owner review created successfully",
      review: data[0],
    });
  } catch (error) {
    console.error("Error creating owner review:", error);
    res.status(500).json({ message: "Error creating owner review" });
  }
};

// Get reviews for a specific owner
export const getOwnerReviews = async (req, res) => {
  try {
    const { owner_id } = req.params;

    const { data, error } = await supabase
      .from("owner_reviews")
      .select(
        `
        id,
        owner_id,
        listing_id,
        renter_id,
        rating,
        title,
        comment,
        created_at,
        users:renter_id (id, full_name, profile_picture),
        listings:listing_id (id, title)
      `,
      )
      .eq("owner_id", owner_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      reviews: data,
      average_rating:
        data.length > 0
          ? Number(
              (
                data.reduce((sum, r) => sum + Number(r.rating || 0), 0) /
                data.length
              ).toFixed(1),
            )
          : 0,
      total_reviews: data.length,
    });
  } catch (error) {
    console.error("Error fetching owner reviews:", error);
    res.status(500).json({ message: "Error fetching owner reviews" });
  }
};
