import { supabase } from "../config/supabase.js";

// Return site-wide metrics used by the homepage
export const getStats = async (req, res) => {
  try {
    // Active listings = listings with status == 'approved'
    const { count: activeCount, error: activeErr } = await supabase
      .from("listings")
      .select("id", { head: true, count: "exact" })
      .eq("status", "approved");

    if (activeErr) throw activeErr;

    // Happy students = registered users with role 'renter'
    const { count: renterCount, error: renterErr } = await supabase
      .from("users")
      .select("id", { head: true, count: "exact" })
      .eq("role", "renter");

    if (renterErr) throw renterErr;

    // Verified owners
    const { count: verifiedOwnersCount, error: ownerErr } = await supabase
      .from("users")
      .select("id", { head: true, count: "exact" })
      .eq("role", "owner")
      .eq("verified", true);

    if (ownerErr) throw ownerErr;

    // Satisfaction rate = average rating across all reviews (1-5) shown as percentage
    const { data: ratings, error: ratingsErr } = await supabase
      .from("reviews")
      .select("rating");

    if (ratingsErr) throw ratingsErr;

    const avgRating =
      ratings && ratings.length > 0
        ? ratings.reduce((s, r) => s + (r.rating || 0), 0) / ratings.length
        : 0;

    const satisfactionRate = Math.round((avgRating / 5) * 100);

    res.json({
      activeListings: activeCount || 0,
      happyStudents: renterCount || 0,
      verifiedOwners: verifiedOwnersCount || 0,
      satisfactionRate: satisfactionRate || 0,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};
