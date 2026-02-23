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
      { count: "exact" }
    );

    if (start_date && end_date) {
      query = query.gte("created_at", start_date).lte("created_at", end_date);
    }

    const { data: users, error: usersError, count } = await query;

    if (usersError) throw usersError;

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
    const { status, limit = 30 } = req.query;

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
      { count: "exact" }
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
      `
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
