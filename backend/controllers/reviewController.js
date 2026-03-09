import { supabase } from "../config/supabase.js";

// Create a review for a listing
export const createReview = async (req, res) => {
  try {
    const { listing_id, rating, title, comment } = req.body;
    const renter_id = req.user.id;

    // Validate input
    if (!listing_id || !rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Invalid listing ID or rating (1-5 required)" });
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

    // Only allow reviews from renters who have an accepted/active agreement
    const { data: agreement, error: agreementError } = await supabase
      .from("agreements")
      .select("id, status")
      .eq("listing_id", listing_id)
      .eq("renter_id", renter_id)
      .in("status", ["confirmed", "active"])
      .maybeSingle();

    if (agreementError) throw agreementError;

    if (!agreement) {
      return res.status(403).json({
        message:
          "You can only review a boarding house after confirming your agreement",
      });
    }

    // Check if renter has already reviewed this listing
    const { data: existingReview } = await supabase
      .from("reviews")
      .select("id")
      .eq("listing_id", listing_id)
      .eq("renter_id", renter_id)
      .single();

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this listing" });
    }

    // Create review
    const { data, error } = await supabase
      .from("reviews")
      .insert([
        {
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
      message: "Review created successfully",
      review: data[0],
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ message: "Error creating review" });
  }
};

// Get reviews for a listing
export const getListingReviews = async (req, res) => {
  try {
    const { listing_id } = req.params;

    const { data, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        listing_id,
        renter_id,
        rating,
        title,
        comment,
        created_at,
        users:renter_id (id, full_name, profile_picture)
      `,
      )
      .eq("listing_id", listing_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      reviews: data,
      average_rating:
        data.length > 0
          ? (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(
              1,
            )
          : 0,
      total_reviews: data.length,
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Error fetching reviews" });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const { rating, title, comment } = req.body;
    const user_id = req.user.id;

    // Get review to verify ownership
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("renter_id")
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.renter_id !== user_id) {
      return res
        .status(403)
        .json({ message: "You can only update your own reviews" });
    }

    // Update review
    const { data, error } = await supabase
      .from("reviews")
      .update({
        rating: rating || undefined,
        title: title !== undefined ? title : undefined,
        comment: comment !== undefined ? comment : undefined,
      })
      .eq("id", review_id)
      .select();

    if (error) throw error;

    res.json({ message: "Review updated successfully", review: data[0] });
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).json({ message: "Error updating review" });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { review_id } = req.params;
    const user_id = req.user.id;

    // Get review to verify ownership
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("renter_id")
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.renter_id !== user_id && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "You can only delete your own reviews" });
    }

    // Delete review
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", review_id);

    if (error) throw error;

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Error deleting review" });
  }
};

// Get all reviews (admin only)
export const getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, listing_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase.from("reviews").select(
      `
        id,
        listing_id,
        renter_id,
        rating,
        title,
        comment,
        created_at,
        users:renter_id (id, full_name, profile_picture),
        listings:listing_id (id, title, owner:owner_id(id, full_name))
      `,
      { count: "exact" },
    );

    if (listing_id) {
      query = query.eq("listing_id", listing_id);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Compute weighted average from total 1★-5★ counts (across all matched reviews)
    let ratingsQuery = supabase.from("reviews").select("rating");
    if (listing_id) {
      ratingsQuery = ratingsQuery.eq("listing_id", listing_id);
    }

    const { data: allRatings, error: ratingsError } = await ratingsQuery;
    if (ratingsError) throw ratingsError;

    const star_counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let weightedTotal = 0;

    (allRatings || []).forEach((row) => {
      const rating = Number(row?.rating);
      if (rating >= 1 && rating <= 5) {
        star_counts[rating] += 1;
        weightedTotal += rating;
      }
    });

    const totalReviewsFromStars =
      star_counts[1] +
      star_counts[2] +
      star_counts[3] +
      star_counts[4] +
      star_counts[5];

    const average_rating =
      totalReviewsFromStars > 0
        ? Number((weightedTotal / totalReviewsFromStars).toFixed(1))
        : 0;

    res.json({
      reviews: data,
      average_rating,
      star_counts,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    res.status(500).json({ message: "Error fetching reviews" });
  }
};
