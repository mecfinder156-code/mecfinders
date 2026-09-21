'use strict';

/**
 * Flexible pricing computation shared by original-service pricing (PriceModel)
 * and additional-service pricing (MechanicServicePricing).
 *
 * The mechanic ALWAYS earns exactly `servicePrice`. Everything charged on top
 * (GST, platform fee, and any admin-configured extra taxes / fees / discounts)
 * belongs to the company. So:
 *
 *   totalPrice    = servicePrice + GST + platformFee + Σ(extra charges/discounts)
 *   companyAmount = totalPrice - servicePrice   (robust to ANY charge changes)
 *   providerEarning = servicePrice
 *
 * Because the bill is derived from a generic `breakdown` array plus servicePrice
 * and totalPrice, admins can add/remove taxes, fees or discounts later without
 * breaking the apps — they just render whatever components exist, and the
 * mechanic/company split stays correct.
 *
 * `charges`: [{ name, mode: 'PERCENT'|'FLAT', value, isDiscount }]
 *   - PERCENT is a percentage of servicePrice.
 *   - isDiscount makes the component reduce the total.
 */

function round(n) {
  return Math.round(Number(n) || 0);
}

function computePricing({ servicePrice, gstPercentage = 0, platformFee = 0, charges = [] } = {}) {
  const base = round(servicePrice);
  const gstPct = Number(gstPercentage) || 0;
  const fee = round(platformFee);

  const gstAmount = round((base * gstPct) / 100);

  const breakdown = [];
  if (gstAmount) breakdown.push({ label: gstPct ? `GST (${gstPct}%)` : 'GST', kind: 'TAX', amount: gstAmount });
  if (fee) breakdown.push({ label: 'Platform Fee', kind: 'FEE', amount: fee });

  let extras = 0;
  for (const c of Array.isArray(charges) ? charges : []) {
    const raw = c.mode === 'PERCENT' ? (base * (Number(c.value) || 0)) / 100 : Number(c.value) || 0;
    let amount = round(raw);
    if (c.isDiscount) amount = -Math.abs(amount);
    extras += amount;
    breakdown.push({
      label: c.name || (c.isDiscount ? 'Discount' : 'Charge'),
      kind: c.isDiscount ? 'DISCOUNT' : c.mode === 'PERCENT' ? 'TAX' : 'FEE',
      amount,
    });
  }

  const totalPrice = round(base + gstAmount + fee + extras);
  const companyAmount = totalPrice - base;

  return {
    servicePrice: base,
    gstPercentage: gstPct,
    platformFee: fee,
    gstAmount,
    charges: Array.isArray(charges) ? charges : [],
    breakdown,
    totalPrice,
    companyAmount,
    // Backward-compatible alias kept for existing consumers/admin UI.
    completePlatformFee: companyAmount,
  };
}

module.exports = { computePricing, round };
