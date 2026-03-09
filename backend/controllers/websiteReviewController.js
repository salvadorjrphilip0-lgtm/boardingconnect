import { supabase } from "../config/supabase.js";

const sanitizeComment = (value) => String(value || "").trim();

export const submitWebsiteReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (!["renter", "owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Only renter or owner can submit website reviews" });
    }

    const numericRating = Number(rating);
    const normalizedComment = sanitizeComment(comment);

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res
        .status(400)
        .json({ message: "Rating must be an integer from 1 to 5" });
    }

    if (!normalizedComment) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id, website_rating")
      .eq("id", userId)
      .single();

    if (existingError || !existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      existingUser.website_rating !== null &&
      existingUser.website_rating !== undefined
    ) {
      return res
        .status(400)
        .json({ message: "You have already rated the website" });
    }

    const reviewedAt = new Date().toISOString();

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        website_rating: numericRating,
        website_review_comment: normalizedComment,
        website_reviewed_at: reviewedAt,
      })
      .eq("id", userId)
      .select("id, website_rating, website_review_comment, website_reviewed_at")
      .single();

    if (updateError) throw updateError;

    res.status(201).json({
      message: "Website review submitted successfully",
      review: updatedUser,
    });
  } catch (error) {
    console.error("Submit website review error:", error);
    res.status(500).json({ message: "Error submitting website review" });
  }
};

export const getMyWebsiteReview = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("id, website_rating, website_review_comment, website_reviewed_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      rated: data.website_rating !== null && data.website_rating !== undefined,
      review:
        data.website_rating !== null && data.website_rating !== undefined
          ? {
              rating: data.website_rating,
              comment: data.website_review_comment,
              reviewed_at: data.website_reviewed_at,
            }
          : null,
    });
  } catch (error) {
    console.error("Get my website review error:", error);
    res.status(500).json({ message: "Error fetching website review" });
  }
};

export const getWebsiteReviewSummary = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, full_name, role, website_rating, website_review_comment, website_reviewed_at",
      )
      .in("role", ["renter", "owner"])
      .not("website_rating", "is", null)
      .order("website_reviewed_at", { ascending: false });

    if (error) throw error;

    const reviews = (data || []).map((item) => ({
      id: item.id,
      full_name: item.full_name,
      role: item.role,
      rating: item.website_rating,
      comment: item.website_review_comment,
      reviewed_at: item.website_reviewed_at,
    }));

    const star_counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let weightedTotal = 0;

    reviews.forEach((review) => {
      const rating = Number(review.rating);
      if (rating >= 1 && rating <= 5) {
        star_counts[rating] += 1;
        weightedTotal += rating;
      }
    });

    const total_reviews = reviews.length;
    const average_rating =
      total_reviews > 0
        ? Number((weightedTotal / total_reviews).toFixed(1))
        : 0;

    res.json({
      summary: {
        total_reviews,
        average_rating,
        star_counts,
      },
      reviews,
    });
  } catch (error) {
    console.error("Get website review summary error:", error);
    res.status(500).json({ message: "Error fetching website review summary" });
  }
};
