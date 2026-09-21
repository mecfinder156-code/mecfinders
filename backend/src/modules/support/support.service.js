'use strict';

const Faq = require('./faq.model');
const SupportQuery = require('./supportQuery.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const notificationService = require('../notifications/notification.service');
const logger = require('../../utils/logger');

const faqCacheKey = (audience) => `support:faqs:${audience}`;

class SupportService {
  // ---------------------------------------------------------------- FAQs ----

  /** Admin: list all FAQs, optionally filtered by audience. */
  async listFaqs({ audience } = {}) {
    const filter = {};
    if (audience) filter.audience = audience;
    return Faq.find(filter).sort({ audience: 1, category: 1, order: 1, createdAt: 1 });
  }

  /**
   * Mobile: active FAQs for one audience, grouped by category. Cached since it
   * changes rarely and is hit on every Help screen open.
   */
  async getPublicFaqs(audience) {
    if (!['customer', 'provider'].includes(audience)) {
      throw ApiError.badRequest('Invalid audience');
    }
    return cache.getOrSet(faqCacheKey(audience), 300, async () => {
      const faqs = await Faq.find({ audience, isActive: true })
        .sort({ category: 1, order: 1, createdAt: 1 })
        .select('question answer category')
        .lean();
      // Group into { category, items: [...] } for accordion rendering.
      const groups = new Map();
      for (const f of faqs) {
        const key = f.category || 'General';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ _id: f._id, question: f.question, answer: f.answer });
      }
      return [...groups.entries()].map(([category, items]) => ({ category, items }));
    });
  }

  async createFaq(data) {
    const faq = await Faq.create(data);
    await cache.invalidate(faqCacheKey(faq.audience));
    return faq;
  }

  async updateFaq(id, data) {
    const faq = await Faq.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!faq) throw ApiError.notFound('FAQ not found');
    // Bust both audiences in case `audience` itself changed.
    await Promise.all([
      cache.invalidate(faqCacheKey('customer')),
      cache.invalidate(faqCacheKey('provider')),
    ]);
    return faq;
  }

  async deleteFaq(id) {
    const faq = await Faq.findByIdAndDelete(id);
    if (!faq) throw ApiError.notFound('FAQ not found');
    await cache.invalidate(faqCacheKey(faq.audience));
    return faq;
  }

  // ------------------------------------------------------------- Queries ----

  /** Mobile: a user raises a support query. */
  async createQuery(user, { subject, message, bookingId }) {
    const query = await SupportQuery.create({
      userId: user._id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
      subject,
      message,
      bookingId: bookingId || null,
      replies: [{ author: 'user', authorId: user._id, message }],
    });
    return query;
  }

  /** Mobile: a user's own queries, newest first. */
  async listUserQueries(userId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      SupportQuery.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportQuery.countDocuments({ userId }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
  }

  /** Mobile: a user reads one of their own queries (with the reply thread). */
  async getUserQuery(userId, id) {
    const query = await SupportQuery.findOne({ _id: id, userId }).lean();
    if (!query) throw ApiError.notFound('Query not found');
    return query;
  }

  // --- Admin ---

  /** Admin: inbox with optional status / role filters. */
  async listQueries({ status, role, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    const skip = (page - 1) * limit;
    const [items, total, openCount] = await Promise.all([
      SupportQuery.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportQuery.countDocuments(filter),
      SupportQuery.countDocuments({ status: 'OPEN' }),
    ]);
    return { items, total, openCount, page, limit, pages: Math.ceil(total / limit) || 1 };
  }

  async getQuery(id) {
    const query = await SupportQuery.findById(id).lean();
    if (!query) throw ApiError.notFound('Query not found');
    return query;
  }

  /**
   * Admin replies to a query. Appends to the thread, marks it ANSWERED, and
   * notifies the user (in-app + push, best-effort).
   */
  async replyToQuery(id, adminUser, message) {
    const query = await SupportQuery.findById(id);
    if (!query) throw ApiError.notFound('Query not found');

    query.replies.push({ author: 'admin', authorId: adminUser._id, message });
    if (query.status === 'OPEN') query.status = 'ANSWERED';
    if (!query.resolvedAt) query.resolvedAt = new Date();
    await query.save();

    // Let the user know support responded.
    try {
      await notificationService.notify({
        userId: query.userId,
        role: query.role,
        type: 'SUPPORT_REPLY',
        title: 'Support replied 💬',
        body: `Re: ${query.subject}`,
        data: { queryId: String(query._id), subject: query.subject },
      });
    } catch (err) {
      logger.error(`support reply notify failed: ${err.message}`);
    }

    return query;
  }

  async updateQueryStatus(id, status) {
    if (!['OPEN', 'ANSWERED', 'CLOSED'].includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }
    const update = { status };
    if (status === 'CLOSED') update.resolvedAt = new Date();
    const query = await SupportQuery.findByIdAndUpdate(id, update, { new: true });
    if (!query) throw ApiError.notFound('Query not found');
    return query;
  }
}

module.exports = new SupportService();
