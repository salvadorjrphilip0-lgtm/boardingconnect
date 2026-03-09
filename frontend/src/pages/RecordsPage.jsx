import React, { useEffect, useMemo, useState } from "react";
import { reportService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import AdminSidebar from "../components/AdminSidebar";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

export default function RecordsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchRecords();
  }, [user]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const data = await reportService.getMonthlyIncomeRecords(1, 1000);
      setRecords(data?.records || []);
    } catch (error) {
      console.error("Failed to load monthly income records:", error);
      toast.error("Failed to load monthly income records");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleDateString();
  };

  const getMonthStayed = (listingPrice, totalPayment) => {
    const price = Number(listingPrice);
    const payment = Number(totalPayment);

    if (!Number.isFinite(price) || price <= 0) return "-";
    if (!Number.isFinite(payment) || payment < 0) return "-";

    if (payment < price) {
      if (payment === 0) return "0 days";
      const days = Math.max(1, Math.round((payment / price) * 30));
      return `${days} day${days === 1 ? "" : "s"}`;
    }

    const monthsRaw = payment / price;
    const monthsRounded = Number(monthsRaw.toFixed(2));

    if (monthsRounded === 1) return "1 month";
    return `${monthsRounded} months`;
  };

  const getMonthlyPayment = (listingPrice, totalPayment) => {
    const price = Number(listingPrice);
    const payment = Number(totalPayment);

    if (Number.isFinite(price) && price > 0) {
      return price;
    }

    if (Number.isFinite(payment) && payment > 0) {
      return payment;
    }

    return 0;
  };

  const monthlySummary = useMemo(() => {
    const grouped = {};

    records.forEach((record) => {
      const dt = record?.recorded_at ? new Date(record.recorded_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;

      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = dt.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          key: monthKey,
          label: monthLabel,
          totalIncome: 0,
          entries: 0,
        };
      }

      grouped[monthKey].totalIncome += Number(record.total_payment) || 0;
      grouped[monthKey].entries += 1;
    });

    return Object.values(grouped).sort((a, b) => b.key.localeCompare(a.key));
  }, [records]);

  const recordsByMonth = useMemo(() => {
    const grouped = {};

    (records || []).forEach((record) => {
      const dt = record?.recorded_at ? new Date(record.recorded_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;

      const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(record);
    });

    return grouped;
  }, [records]);

  const escapeCsvValue = (value) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadMonthlyCsv = (monthKey, monthLabel) => {
    const monthRecords = recordsByMonth[monthKey] || [];

    if (monthRecords.length === 0) {
      toast.error("No records found for this month.");
      return;
    }

    const headers = [
      "Name of Renter",
      "Title",
      "Owner",
      "Price",
      "Monthly Payment",
      "Total Payment",
      "Month Stayed",
      "Type of Payment",
      "Date",
    ];

    const rows = monthRecords.map((record) => [
      record.renter?.full_name || "Unknown Renter",
      record.listing?.title || "Untitled Listing",
      record.owner?.full_name || "Unknown Owner",
      Number(record.listing_price || 0).toFixed(2),
      Number(
        getMonthlyPayment(record.listing_price, record.total_payment) || 0,
      ).toFixed(2),
      Number(record.total_payment || 0).toFixed(2),
      getMonthStayed(record.listing_price, record.total_payment),
      record.payment_type || "unpaid",
      formatDate(record.recorded_at),
    ]);

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monthly-income-${monthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded CSV for ${monthLabel}`);
  };

  const grandTotal = useMemo(
    () =>
      records.reduce(
        (sum, record) => sum + (Number(record.total_payment) || 0),
        0,
      ),
    [records],
  );

  const donutData = useMemo(() => {
    const buckets = {
      paid: {
        key: "paid",
        label: "Paid",
        color: "#16a34a",
        value: 0,
      },
      partial: {
        key: "partial",
        label: "Partial",
        color: "#f59e0b",
        value: 0,
      },
      unpaid: {
        key: "unpaid",
        label: "Unpaid",
        color: "#6b7280",
        value: 0,
      },
    };

    (records || []).forEach((record) => {
      const paymentType = String(
        record?.payment_type || "unpaid",
      ).toLowerCase();
      const amount = Number(record?.total_payment) || 0;
      const bucket = buckets[paymentType] || buckets.unpaid;
      bucket.value += amount;
    });

    const segments = Object.values(buckets);
    const total = segments.reduce((sum, item) => sum + item.value, 0);
    return { segments, total };
  }, [records]);

  const donutGeometry = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    const segments = donutData.segments.map((segment) => {
      const fraction =
        donutData.total > 0 ? segment.value / donutData.total : 0;
      const arc = fraction * circumference;
      const segmentData = {
        ...segment,
        fraction,
        arc,
        offset: cumulative,
      };
      cumulative += arc;
      return segmentData;
    });

    return { radius, circumference, segments };
  }, [donutData]);

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600">
              Only administrators can view records.
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
            <h1 className="text-3xl font-bold text-gray-900">Records</h1>
            <p className="text-gray-600 mt-2">
              Monthly income records based on owner payment saves
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Monthly Income Summary
            </h2>

            {loading ? (
              <p className="text-gray-600">Loading summary...</p>
            ) : monthlySummary.length === 0 ? (
              <p className="text-gray-600">No monthly income records yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-left">Month</th>
                      <th className="px-3 py-2 text-left">Entries</th>
                      <th className="px-3 py-2 text-left">Total Income</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlySummary.map((row) => (
                      <tr key={row.key} className="border-b">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">{row.entries}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">
                          {formatCurrency(row.totalIncome)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              downloadMonthlyCsv(row.key, row.label)
                            }
                            className="px-3 py-1 text-xs rounded-md border border-primary-300 text-primary-700 hover:bg-primary-50"
                          >
                            Download Records Here
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <span className="font-semibold">Grand Total:</span>{" "}
                  {formatCurrency(grandTotal)}
                </div>

                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Income Composition by Payment Type
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="flex justify-center">
                      <div className="relative h-64 w-64">
                        <svg
                          viewBox="0 0 140 140"
                          className="h-full w-full -rotate-90"
                        >
                          <circle
                            cx="70"
                            cy="70"
                            r={donutGeometry.radius}
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="18"
                          />

                          {donutGeometry.segments.map((segment) =>
                            segment.arc > 0 ? (
                              <circle
                                key={`donut-${segment.key}`}
                                cx="70"
                                cy="70"
                                r={donutGeometry.radius}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="18"
                                strokeLinecap="round"
                                strokeDasharray={`${segment.arc} ${donutGeometry.circumference - segment.arc}`}
                                strokeDashoffset={-segment.offset}
                              />
                            ) : null,
                          )}
                        </svg>

                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <p className="text-xs text-gray-500 uppercase tracking-wide">
                            Total Income
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            {formatCurrency(donutData.total)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {donutGeometry.segments.map((segment) => (
                        <div
                          key={`legend-${segment.key}`}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: segment.color }}
                            />
                            <span className="font-medium text-gray-800">
                              {segment.label}
                            </span>
                          </div>

                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(segment.value)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Math.round((segment.fraction || 0) * 100)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Monthly Income Records
            </h2>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading records...</p>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="px-3 py-2 text-left">Name of Renter</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Owner</th>
                      <th className="px-3 py-2 text-left">Price</th>
                      <th className="px-3 py-2 text-left">Monthly Payment</th>
                      <th className="px-3 py-2 text-left">Total Payment</th>
                      <th className="px-3 py-2 text-left">Month Stayed</th>
                      <th className="px-3 py-2 text-left">Type of Payment</th>
                      <th className="px-3 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="px-3 py-2">
                          {record.renter?.full_name || "Unknown Renter"}
                        </td>
                        <td className="px-3 py-2">
                          {record.listing?.title || "Untitled Listing"}
                        </td>
                        <td className="px-3 py-2">
                          {record.owner?.full_name || "Unknown Owner"}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(record.listing_price)}
                        </td>
                        <td className="px-3 py-2">
                          {formatCurrency(
                            getMonthlyPayment(
                              record.listing_price,
                              record.total_payment,
                            ),
                          )}
                        </td>
                        <td className="px-3 py-2 font-semibold text-emerald-700">
                          {formatCurrency(record.total_payment)}
                        </td>
                        <td className="px-3 py-2">
                          {getMonthStayed(
                            record.listing_price,
                            record.total_payment,
                          )}
                        </td>
                        <td className="px-3 py-2 capitalize">
                          {record.payment_type || "unpaid"}
                        </td>
                        <td className="px-3 py-2">
                          {formatDate(record.recorded_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
