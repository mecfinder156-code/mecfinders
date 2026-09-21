'use strict';

const BookingService = require('./bookingService.model');
const { BOOKING_SERVICE_STATUS } = require('./booking.constants');

// Only these line-item states contribute to the bill. REJECTED/REQUESTED
// (un-approved) additional services are never charged.
const BILLABLE_STATUSES = [
  BOOKING_SERVICE_STATUS.ACCEPTED,
  BOOKING_SERVICE_STATUS.IN_PROGRESS,
  BOOKING_SERVICE_STATUS.COMPLETED,
];

/**
 * Compute a booking's bill purely from the immutable price snapshots on its
 * billable line items. This never reads the live pricing models, so historical
 * bills are stable even if admin later changes prices.
 *
 * Provider earning = sum of service prices only.
 * Company amount   = sum of (GST + platform fee).
 * Total (customer) = sum of line-item totals.
 */
async function computeBill(bookingId) {
  const items = await BookingService.find({
    bookingId,
    status: { $in: BILLABLE_STATUSES },
  }).lean();

  let serviceCharges = 0;
  let gstAmount = 0;
  let platformFee = 0;
  let totalAmount = 0;
  const breakdownMap = new Map(); // label -> { label, kind, amount }

  const lineItems = items.map((it) => {
    const p = it.priceSnapshot;
    serviceCharges += p.servicePrice;
    gstAmount += p.gstAmount || 0;
    platformFee += p.platformFee || 0;
    totalAmount += p.totalPrice;

    // Merge each line item's generic breakdown so the bill reflects whatever
    // taxes/fees/discounts were configured, robust to admin changes.
    for (const line of p.breakdown || []) {
      const existing = breakdownMap.get(line.label);
      if (existing) existing.amount += line.amount;
      else breakdownMap.set(line.label, { label: line.label, kind: line.kind, amount: line.amount });
    }

    return {
      bookingServiceId: it._id,
      name: it.name,
      kind: it.kind,
      servicePrice: p.servicePrice,
      totalPrice: p.totalPrice,
    };
  });

  const providerEarning = serviceCharges;
  // Company gets everything the customer pays beyond the mechanic's earning —
  // correct no matter how many taxes/fees/discounts are configured.
  const companyAmount = totalAmount - serviceCharges;

  return {
    lineItems,
    breakdown: Array.from(breakdownMap.values()),
    serviceCharges,
    gstAmount,
    platformFee,
    totalAmount,
    providerEarning,
    companyAmount,
  };
}

/**
 * Compute + persist the bill onto the booking document. Returns the totals.
 */
async function generateBill(booking) {
  const bill = await computeBill(booking._id);
  booking.bill = {
    serviceCharges: bill.serviceCharges,
    gstAmount: bill.gstAmount,
    platformFee: bill.platformFee,
    totalAmount: bill.totalAmount,
    providerEarning: bill.providerEarning,
    companyAmount: bill.companyAmount,
    breakdown: bill.breakdown,
    generatedAt: new Date(),
  };
  return bill;
}

module.exports = { computeBill, generateBill, BILLABLE_STATUSES };
