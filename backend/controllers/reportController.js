import { supabase } from "../config/supabase.js";

// Generate user activity report (admin only)
export const generateUserActivityReport = async (req, res) => {
  try {
    const admin_id = req.user.id;
    const { start_date, end_date } = req.body;

    // Build query for user stats
    let query = supabase.from("users").select(
      `
        id,
        full_name,
        email,
        role,
        created_at,
        listings:listings(count),
        applications:applications(count),
        messages_sent:messages(count)
      `,
      { count: "exact" },
    );

    if (start_date && end_date) {
      query = query.gte("created_at", start_date).lte("created_at", end_date);
    }

    const { data: users, error: usersError, count } = await query;

    if (usersError) throw usersError;

    // Build renter tenancy list for admin summary
    let agreementsQuery = supabase
      .from("agreements")
      .select(
        `
          id,
          renter_confirmed_at,
          end_date,
          due_date,
          rent_status,
          renter:users!renter_id(id, full_name, phone, role),
          listing:listings(id, title)
        `,
      )
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });

    if (start_date && end_date) {
      agreementsQuery = agreementsQuery
        .gte("created_at", start_date)
        .lte("created_at", end_date);
    }

    const { data: agreements, error: agreementsError } = await agreementsQuery;
    if (agreementsError) throw agreementsError;

    const rentersList = (agreements || [])
      .filter((agreement) => agreement?.renter?.role === "renter")
      .map((agreement) => ({
        renter_name: agreement?.renter?.full_name || "Unknown Renter",
        contact_number: agreement?.renter?.phone || "N/A",
        boarding_house_title: agreement?.listing?.title || "Untitled Listing",
        move_in_date: agreement?.renter_confirmed_at || null,
        contract_date: agreement?.end_date || null,
        renter_status: agreement?.rent_status === "paid" ? "paid" : "partial",
      }));

    // Calculate statistics
    const totalUsers = count;
    const usersByRole = {};
    let totalListings = 0;
    let totalApplications = 0;

    users.forEach((user) => {
      usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
    });

    // Create report
    const reportData = {
      total_users: totalUsers,
      users_by_role: usersByRole,
      total_renters_in_contract: rentersList.length,
      renters_list: rentersList,
      report_generated_at: new Date().toISOString(),
      period: {
        start: start_date || "all_time",
        end: end_date || "current",
      },
    };

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert([
        {
          type: "user_activity",
          title: "User Activity Report",
          description: `Report for period ${
            start_date ? start_date.split("T")[0] : "All time"
          } to ${end_date ? end_date.split("T")[0] : "Current"}`,
          generated_by: admin_id,
          data: reportData,
        },
      ])
      .select();

    if (reportError) throw reportError;

    res.status(201).json({
      message: "Report generated successfully",
      report: report[0],
    });
  } catch (error) {
    console.error("Error generating user activity report:", error);
    res.status(500).json({ message: "Error generating report" });
  }
};

// Generate listing verification report (admin only)
export const generateListingVerificationReport = async (req, res) => {
  try {
    const admin_id = req.user.id;

    // Get listing statistics
    const {
      data: listings,
      error: listingsError,
      count,
    } = await supabase
      .from("listings")
      .select("id, status, verified, created_at", { count: "exact" });

    if (listingsError) throw listingsError;

    // Calculate statistics
    const verifiedCount = listings.filter((l) => l.verified).length;
    const unverifiedCount = listings.filter((l) => !l.verified).length;
    const statusBreakdown = {};

    listings.forEach((listing) => {
      statusBreakdown[listing.status] =
        (statusBreakdown[listing.status] || 0) + 1;
    });

    const reportData = {
      total_listings: count,
      verified_listings: verifiedCount,
      unverified_listings: unverifiedCount,
      verification_rate: ((verifiedCount / count) * 100).toFixed(2),
      listings_by_status: statusBreakdown,
      report_generated_at: new Date().toISOString(),
    };

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert([
        {
          type: "listing_verification",
          title: "Listing Verification Report",
          description: `Listing verification status as of ${new Date().toDateString()}`,
          generated_by: admin_id,
          data: reportData,
        },
      ])
      .select();

    if (reportError) throw reportError;

    res.status(201).json({
      message: "Report generated successfully",
      report: report[0],
    });
  } catch (error) {
    console.error("Error generating listing verification report:", error);
    res.status(500).json({ message: "Error generating report" });
  }
};

// Generate concerns summary report (admin only)
export const generateConcernsSummaryReport = async (req, res) => {
  try {
    const admin_id = req.user.id;
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    const status = payload.status;
    const limit = Number(payload.limit || 30);

    // Get concerns
    let query = supabase
      .from("concerns")
      .select("id, status, created_at", { count: "exact" });

    if (status) {
      query = query.eq("status", status);
    }

    const {
      data: concerns,
      error: concernsError,
      count,
    } = await query.limit(limit);

    if (concernsError) throw concernsError;

    // Reviews per posted boarding house
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (listingsError) throw listingsError;

    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select("listing_id");

    if (reviewsError) throw reviewsError;

    const reviewsCountByListingId = {};
    (reviews || []).forEach((review) => {
      if (!review?.listing_id) return;
      reviewsCountByListingId[review.listing_id] =
        (reviewsCountByListingId[review.listing_id] || 0) + 1;
    });

    const reviewsPerBoardingHouse = (listings || []).map((listing) => ({
      label: listing.title || "Untitled Listing",
      listing_id: listing.id,
      value: reviewsCountByListingId[listing.id] || 0,
    }));

    // Concerns per renter
    const { data: allConcernsForRenterStats, error: renterStatsError } =
      await supabase
        .from("concerns")
        .select("renter_id, users:renter_id(full_name)");

    if (renterStatsError) throw renterStatsError;

    const concernsByRenterMap = {};
    (allConcernsForRenterStats || []).forEach((item) => {
      const renterId = item?.renter_id;
      if (!renterId) return;

      const renterName = item?.users?.full_name || "Unknown Renter";
      if (!concernsByRenterMap[renterId]) {
        concernsByRenterMap[renterId] = {
          label: renterName,
          renter_id: renterId,
          value: 0,
        };
      }
      concernsByRenterMap[renterId].value += 1;
    });

    const concernsPerRenter = Object.values(concernsByRenterMap).sort(
      (a, b) => b.value - a.value,
    );

    // Calculate statistics
    const statusBreakdown = {};
    concerns.forEach((concern) => {
      statusBreakdown[concern.status] =
        (statusBreakdown[concern.status] || 0) + 1;
    });

    const reportData = {
      total_concerns: count,
      concerns_by_status: statusBreakdown,
      pending_count: statusBreakdown["pending"] || 0,
      reviewed_count: statusBreakdown["reviewed"] || 0,
      resolved_count: statusBreakdown["resolved"] || 0,
      total_reviews_all_boarding_houses: (reviews || []).length,
      reviews_per_boarding_house: reviewsPerBoardingHouse,
      concerns_per_renter: concernsPerRenter,
      resolution_rate: (
        (((statusBreakdown["reviewed"] || 0) +
          (statusBreakdown["resolved"] || 0)) /
          count) *
        100
      ).toFixed(2),
      report_generated_at: new Date().toISOString(),
    };

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert([
        {
          type: "concerns_summary",
          title: "Concerns Summary Report",
          description: `Summary of all reported concerns as of ${new Date().toDateString()}`,
          generated_by: admin_id,
          data: reportData,
        },
      ])
      .select();

    if (reportError) throw reportError;

    res.status(201).json({
      message: "Report generated successfully",
      report: report[0],
    });
  } catch (error) {
    console.error("Error generating concerns summary report:", error);
    res.status(500).json({ message: "Error generating report" });
  }
};

// Get all reports (admin only)
export const getAllReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase.from("reports").select(
      `
        id,
        type,
        title,
        description,
        generated_by,
        data,
        created_at,
        users:generated_by (id, full_name)
      `,
      { count: "exact" },
    );

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      reports: data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ message: "Error fetching reports" });
  }
};

// Get report details (admin only)
export const getReportDetail = async (req, res) => {
  try {
    const { report_id } = req.params;

    const { data, error } = await supabase
      .from("reports")
      .select(
        `
        id,
        type,
        title,
        description,
        generated_by,
        data,
        created_at,
        users:generated_by (id, full_name, email)
      `,
      )
      .eq("id", report_id)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching report details:", error);
    res.status(500).json({ message: "Error fetching report" });
  }
};

// Delete report (admin only)
export const deleteReport = async (req, res) => {
  try {
    const { report_id } = req.params;

    const { error } = await supabase
      .from("reports")
      .delete()
      .eq("id", report_id);

    if (error) throw error;

    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ message: "Error deleting report" });
  }
};

// Get monthly income records (admin only)
export const getMonthlyIncomeRecords = async (req, res) => {
  try {
    const { page = 1, limit = 500 } = req.query;
    const parsedPage = Number(page) || 1;
    const parsedLimit = Number(limit) || 500;
    const offset = (parsedPage - 1) * parsedLimit;

    const { data, error, count } = await supabase
      .from("monthly_income_records")
      .select(
        `
        id,
        agreement_id,
        listing_id,
        owner_id,
        renter_id,
        listing_price,
        total_payment,
        payment_type,
        recorded_at,
        renter:renter_id(id, full_name),
        owner:owner_id(id, full_name),
        listing:listing_id(id, title)
      `,
        { count: "exact" },
      )
      .order("recorded_at", { ascending: false })
      .range(offset, offset + parsedLimit - 1);

    if (error) throw error;

    const normalizedRecords = (data || []).map((record) => {
      const listingPrice = Number(record?.listing_price) || 0;
      const totalPayment = Number(record?.total_payment) || 0;

      let computedPaymentType = "unpaid";
      if (totalPayment > 0) {
        computedPaymentType =
          listingPrice > 0 && totalPayment < listingPrice ? "partial" : "paid";
      }

      return {
        ...record,
        payment_type: computedPaymentType,
      };
    });

    res.json({
      records: normalizedRecords,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: count || 0,
        pages: Math.ceil((count || 0) / parsedLimit),
      },
    });
  } catch (error) {
    console.error("Error fetching monthly income records:", error);
    res.status(500).json({ message: "Error fetching monthly income records" });
  }
};
