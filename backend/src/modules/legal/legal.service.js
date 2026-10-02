'use strict';

const LegalDocument = require('./legal.model');

const TYPES = ['PRIVACY', 'TERMS'];
const AUDIENCES = ['customer', 'provider'];

const TITLES = {
  PRIVACY: 'Privacy Policy',
  TERMS: 'Terms & Conditions',
};

// Shown until an admin writes real content, so the apps never render blank.
function defaultContent(type, audience) {
  const who = audience === 'provider' ? 'service partners' : 'customers';
  if (type === 'PRIVACY') {
    return `This Privacy Policy explains how MecFinders collects, uses and protects the information of its ${who}.\n\nWe collect only the data needed to provide the service (your profile, location while a job is active, and booking history) and never sell it. You can request deletion of your account at any time.\n\nAdmins can update this policy from the dashboard. Please check back for the latest version.`;
  }
  return `These Terms & Conditions govern the use of the MecFinders app by ${who}.\n\nBy using the app you agree to provide accurate information, use the service lawfully, and honour the bookings you make or accept. Payments, cancellations and payouts follow the in-app flows.\n\nAdmins can update these terms from the dashboard. Continued use of the app means you accept the current terms.`;
}

function toView(type, audience, doc) {
  return {
    type,
    audience,
    title: (doc && doc.title) || TITLES[type],
    content: doc && doc.content ? doc.content : defaultContent(type, audience),
    updatedAt: doc ? doc.updatedAt : null,
    isDefault: !doc,
  };
}

/** One document (type+audience); returns a default stub when none is saved yet. */
async function getDocument(type, audience) {
  if (!TYPES.includes(type) || !AUDIENCES.includes(audience)) {
    const ApiError = require('../../utils/ApiError');
    throw ApiError.badRequest('Invalid legal document type or audience');
  }
  const doc = await LegalDocument.findOne({ type, audience }).lean();
  return toView(type, audience, doc);
}

/** All 4 documents (filling defaults for any not yet saved) — for the admin editor. */
async function listAll() {
  const docs = await LegalDocument.find({}).lean();
  const byKey = new Map(docs.map((d) => [`${d.type}:${d.audience}`, d]));
  const out = [];
  for (const type of TYPES) {
    for (const audience of AUDIENCES) {
      out.push(toView(type, audience, byKey.get(`${type}:${audience}`)));
    }
  }
  return out;
}

/** Create/update a document's title + content. */
async function upsert(type, audience, { title, content }, adminUserId = null) {
  if (!TYPES.includes(type) || !AUDIENCES.includes(audience)) {
    const ApiError = require('../../utils/ApiError');
    throw ApiError.badRequest('Invalid legal document type or audience');
  }
  const doc = await LegalDocument.findOneAndUpdate(
    { type, audience },
    {
      $set: {
        title: typeof title === 'string' ? title : TITLES[type],
        content: typeof content === 'string' ? content : '',
        updatedBy: adminUserId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return toView(type, audience, doc);
}

module.exports = { getDocument, listAll, upsert, TYPES, AUDIENCES };
