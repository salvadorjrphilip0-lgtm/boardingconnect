const toBadge = (text, bgColor, textColor, borderColor) => ({
  text,
  bgColor,
  textColor,
  borderColor,
  color: `${bgColor} ${textColor} ${borderColor}`,
  className: `${bgColor} ${textColor} ${borderColor}`,
  style: `${bgColor} ${textColor} ${borderColor}`,
});

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const DAY_MS = 1000 * 60 * 60 * 24;

export const parseAgreementTerms = (terms) => {
  if (!terms) return {};
  try {
    const parsed = JSON.parse(terms);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const getPaymentAmountFromAgreement = (agreement) => {
  const terms = parseAgreementTerms(agreement?.terms);
  const amount = Number(terms?.payment_amount);
  return Number.isFinite(amount) ? amount : 0;
};

export const getPaymentStatusBadge = (agreement) => {
  const listingPrice = Number(agreement?.listing?.price) || 0;
  const paymentAmount = getPaymentAmountFromAgreement(agreement);

  if (listingPrice > 0 && paymentAmount >= listingPrice) {
    return toBadge(
      "Paid",
      "bg-green-100",
      "text-green-700",
      "border-green-300",
    );
  }

  if (paymentAmount > 0 && listingPrice > 0 && paymentAmount < listingPrice) {
    return toBadge(
      "Partial",
      "bg-orange-100",
      "text-orange-700",
      "border-orange-300",
    );
  }

  if (agreement?.rent_status === "paid") {
    return toBadge(
      "Paid",
      "bg-green-100",
      "text-green-700",
      "border-green-300",
    );
  }

  return toBadge("Unpaid", "bg-gray-100", "text-gray-700", "border-gray-300");
};

export const getTimeStatusBadge = (agreement) => {
  if (agreement?.rent_status === "cancelled") {
    return toBadge(
      "Cancelled",
      "bg-gray-100",
      "text-gray-700",
      "border-gray-300",
    );
  }

  const dueDate = normalizeDate(agreement?.due_date);
  const today = normalizeDate(new Date());

  // Owner-renter status should be based on due date cycle, not contract date.
  // cycleDay = 30 - daysUntilDue
  // - 1..23  => On Track
  // - 24..29 => Due in X
  // - 30     => Overdue
  // - 31..37 => Overdue in X (and row red in owner table)
  if (dueDate) {
    const daysUntilDue = Math.floor((dueDate - today) / DAY_MS);
    const cycleDay = Math.max(1, 30 - daysUntilDue);

    if (cycleDay <= 23) {
      return toBadge(
        "On Track",
        "bg-green-100",
        "text-green-700",
        "border-green-300",
      );
    }

    if (cycleDay >= 24 && cycleDay <= 29) {
      const daysRemaining = 30 - cycleDay;
      return toBadge(
        `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
        "bg-orange-100",
        "text-orange-700",
        "border-orange-300",
      );
    }

    if (cycleDay === 30) {
      return toBadge("Overdue", "bg-red-100", "text-red-700", "border-red-300");
    }

    if (cycleDay >= 31 && cycleDay <= 37) {
      const overdueBy = cycleDay - 30;
      return toBadge(
        `Overdue in ${overdueBy} day${overdueBy === 1 ? "" : "s"}`,
        "bg-red-200",
        "text-red-800",
        "border-red-400",
      );
    }

    return toBadge("Overdue", "bg-red-200", "text-red-800", "border-red-400");
  }

  return toBadge(
    "No Due Date",
    "bg-gray-100",
    "text-gray-700",
    "border-gray-300",
  );
};

export const getRentCycleDay = (agreement) => {
  const dueDate = normalizeDate(agreement?.due_date);
  const today = normalizeDate(new Date());

  if (!dueDate) return null;

  const daysUntilDue = Math.floor((dueDate - today) / DAY_MS);
  return Math.max(1, 30 - daysUntilDue);
};

export const getRenterStatusBadge = (agreement) => {
  const paymentBadge = getPaymentStatusBadge(agreement);
  const timeBadge = getTimeStatusBadge(agreement);

  if (paymentBadge.text === "Paid" || timeBadge.text === "Cancelled") {
    return paymentBadge.text === "Paid" ? paymentBadge : timeBadge;
  }

  return timeBadge;
};
