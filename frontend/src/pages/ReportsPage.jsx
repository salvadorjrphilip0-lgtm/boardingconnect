import React, { useEffect, useState } from "react";
import { reportService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchReports();
  }, [page, filter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await reportService.getAll(page, 20, filter);
      setReports(data.reports || []);
      setTotalPages(Math.ceil((data.pagination?.total || 0) / 20));
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const generateUserActivityReport = async () => {
    try {
      setGenerating(true);
      await reportService.generateUserActivity(null, null);
      toast.success("User Activity Report generated");
      fetchReports();
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const generateListingVerificationReport = async () => {
    try {
      setGenerating(true);
      await reportService.generateListingVerification();
      toast.success("Listing Verification Report generated");
      fetchReports();
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const generateConcernsSummaryReport = async () => {
    try {
      setGenerating(true);
      await reportService.generateConcernsSummary(null, 30);
      toast.success("Concerns Summary Report generated");
      fetchReports();
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const deleteReport = async (reportId) => {
    try {
      if (window.confirm("Are you sure you want to delete this report?")) {
        await reportService.delete(reportId);
        toast.success("Report deleted successfully");
        fetchReports();
      }
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Failed to delete report");
    }
  };

  const getReportTypeColor = (type) => {
    switch (type) {
      case "user_activity":
        return "bg-blue-100 text-blue-800";
      case "listing_verification":
        return "bg-green-100 text-green-800";
      case "concerns_summary":
        return "bg-purple-100 text-purple-800";
      case "revenue":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const BarChart = ({ items = [], labelKey = "label", valueKey = "value" }) => {
    const max = Math.max(...items.map((i) => i[valueKey] || 0), 1);
    return (
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-32 text-sm text-gray-700">{it[labelKey]}</div>
            <div className="flex-1 bg-gray-200 h-4 rounded overflow-hidden">
              <div
                style={{ width: `${Math.round(((it[valueKey] || 0) / max) * 100)}%` }}
                className="h-4 bg-blue-600"
                title={`${it[valueKey] || 0}`}
              />
            </div>
            <div className="w-16 text-right text-sm text-gray-600">{it[valueKey]}</div>
          </div>
        ))}
      </div>
    );
  };

  const Donut = ({ a = 0, b = 1, size = 80, colors = ["#10B981", "#F3F4F6"] }) => {
    const total = a + b || 1;
    const pct = Math.round((a / total) * 100);
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - a / total);
    return (
      <div className="flex items-center gap-3">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors[1]}
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors[0]}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div className="text-sm">
          <div className="text-lg font-semibold">{pct}%</div>
          <div className="text-xs text-gray-500">of primary</div>
        </div>
      </div>
    );
  };

  const renderReportVisualization = (report) => {
    const data = report.data || {};
    switch (report.type) {
      case "user_activity": {
        const total = data.total_users || data.total || data.accounts_created || 0;
        const byRole = data.users_by_role || data.roles || [];
        const monthly = data.monthly_registrations || data.registrations_by_month || [];
        const activities = data.activities || data.activity_counts || data.event_counts || {};
        const activitiesArray = Array.isArray(activities)
          ? activities
          : Object.entries(activities || {}).map(([k, v]) => ({ label: k, value: v }));

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Accounts created</div>
              <div className="text-2xl font-bold">{total}</div>
              {monthly.length > 0 && (
                <div className="mt-3 text-sm text-gray-500">Recent registrations</div>
              )}
            </div>
            <div className="p-4 bg-white rounded shadow md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500 mb-2">Users by role</div>
                  <BarChart
                    items={Array.isArray(byRole) ? byRole : Object.entries(byRole || {}).map(([k, v]) => ({ label: k, value: v }))}
                    labelKey={"label"}
                    valueKey={"value"}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Activity counts</div>
                  <BarChart items={activitiesArray} />
                </div>
              </div>
              {monthly.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-500 mb-2">Monthly registrations</div>
                  <BarChart items={monthly.map((m) => ({ label: m.month || m.label || m.name, value: m.count || m.value || 0 }))} />
                </div>
              )}
            </div>
          </div>
        );
      }
      case "listing_verification": {
        // Listings by status
        const listingsByStatus = data.listings_by_status || data.listing_status || data.listings_counts || data.listings || {};
        const listingStatuses = Array.isArray(listingsByStatus)
          ? listingsByStatus
          : Object.entries(listingsByStatus || {}).map(([k, v]) => ({ label: k, value: v }));

        // Applicants/applications by status
        const applicantsByStatus = data.applicants_by_status || data.applications_by_status || data.applicant_status || {};
        const applicantStatuses = Array.isArray(applicantsByStatus)
          ? applicantsByStatus
          : Object.entries(applicantsByStatus || {}).map(([k, v]) => ({ label: k, value: v }));

        // Agreements by status
        const agreementsByStatus = data.agreements_by_status || data.agreement_status || data.agreements || {};
        const agreementStatuses = Array.isArray(agreementsByStatus)
          ? agreementsByStatus
          : Object.entries(agreementsByStatus || {}).map(([k, v]) => ({ label: k, value: v }));

        const verified = listingStatuses.find((s) => /verified/i.test(s.label))?.value || 0;
        const pending = listingStatuses.find((s) => /pending/i.test(s.label))?.value || 0;
        const cancelled = listingStatuses.find((s) => /cancel|decline/i.test(s.label))?.value || 0;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500 mb-2">Listings by status</div>
              <BarChart items={listingStatuses.length ? listingStatuses : [
                { label: 'Verified', value: verified },
                { label: 'Pending', value: pending },
                { label: 'Cancelled', value: cancelled },
              ]} />
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500 mb-2">Applicants by status</div>
              {
                (() => {
                  // normalize to map for deterministic totals
                  const map = {};
                  (applicantStatuses || []).forEach(s => {
                    const key = (s.label || '').toString().toLowerCase();
                    map[key] = (map[key] || 0) + (s.value || 0);
                  });
                  const verifiedCount = map['verified'] || map['accepted'] || map['confirmed'] || 0;
                  const pendingCount = map['pending'] || 0;
                  const cancelledCount = map['cancelled'] || map['cancel'] || map['declined'] || 0;
                  const out = [
                    { label: 'Verified', value: verifiedCount },
                    { label: 'Pending', value: pendingCount },
                    { label: 'Cancelled', value: cancelledCount },
                  ];
                  return <BarChart items={out} />;
                })()
              }
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500 mb-2">Agreements by status</div>
              {
                (() => {
                  const map = {};
                  (agreementStatuses || []).forEach(s => {
                    const key = (s.label || '').toString().toLowerCase();
                    map[key] = (map[key] || 0) + (s.value || 0);
                  });
                  const verifiedCount = map['accepted'] || map['accepted'] || map['confirmed'] || map['accepted'] || 0;
                  const pendingCount = map['pending'] || 0;
                  const cancelledCount = map['cancelled'] || map['cancel'] || map['declined'] || 0;
                  const out = [
                    { label: 'Verified', value: verifiedCount },
                    { label: 'Pending', value: pendingCount },
                    { label: 'Cancelled', value: cancelledCount },
                  ];
                  return <BarChart items={out} />;
                })()
              }
            </div>
          </div>
        );
      }
      case "concerns_summary": {
        const top = data.top_reasons || data.reasons || [];
        const recent = data.recent_counts || [];
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500 mb-2">Top reasons</div>
              <BarChart items={(Array.isArray(top)?top: Object.entries(top).map(([k,v])=>({label:k,value:v})))} labelKey={"label"} valueKey={"value"} />
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500 mb-2">Recent counts</div>
              <BarChart items={(Array.isArray(recent)?recent: [])} labelKey={"label"} valueKey={"count"} />
            </div>
          </div>
        );
      }
      case "revenue": {
        const months = data.monthly || data.by_month || [];
        return (
          <div className="p-4 bg-white rounded shadow mb-3">
            <div className="text-sm text-gray-500 mb-2">Revenue by month</div>
            <BarChart items={(Array.isArray(months)?months:[]).map(m=>({label:m.month||m.label,value:Math.round(m.revenue||m.value||0)}))} />
          </div>
        );
      }
      default:
        return (
          <div className="bg-gray-50 p-3 rounded mb-3 max-h-40 overflow-auto">
            <pre className="text-xs text-gray-600 font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">        <Navbar />
        
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600">
              Only administrators can view reports.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-1">
        <AdminSidebar />

        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
           <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
           </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Admin Reports
            </h1>
            <p className="text-gray-600 mb-6">
              Generate and manage system reports
            </p>

            {/* Generate Report Section */}
            <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Generate New Report
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={generateUserActivityReport}
                  disabled={generating}
                  className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold">User Activity</span>
                  <p className="text-sm mt-1">
                    Overview of user registrations and activities
                  </p>
                </button>
                <button
                  onClick={generateListingVerificationReport}
                  disabled={generating}
                  className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold">Listing Verification</span>
                  <p className="text-sm mt-1">
                    Status of listing verification process
                  </p>
                </button>
                <button
                  onClick={generateConcernsSummaryReport}
                  disabled={generating}
                  className="p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-semibold">Concerns Summary</span>
                  <p className="text-sm mt-1">Analysis of reported concerns</p>
                </button>
              </div>
              {generating && (
                <p className="text-sm text-gray-600 mt-4">
                  Generating report...
                </p>
              )}
            </div>

            {/* Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Type
              </label>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Reports</option>
                <option value="user_activity">User Activity</option>
                <option value="listing_verification">
                  Listing Verification
                </option>
                <option value="concerns_summary">Concerns Summary</option>
                <option value="revenue">Revenue</option>
              </select>
            </div>

            {/* Reports List */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading reports...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  No reports found. Generate a new one to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {report.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-3 py-1 text-sm rounded-full font-medium ${getReportTypeColor(
                            report.type,
                          )}`}
                        >
                          {report.type.replace(/_/g, " ")}
                        </span>
                        <p className="text-xs text-gray-500 mt-2">
                          By: {report.users?.full_name || "Admin"}
                        </p>
                      </div>
                    </div>

                    {/* Report Data Visualization */}
                    {report.data && renderReportVisualization(report)}

                    <div className="flex justify-between items-center mt-4">
                      <p className="text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedReport(report.id)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => deleteReport(report.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-600 hover:bg-red-200 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}