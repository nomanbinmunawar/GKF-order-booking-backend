/**
 * validate.js
 * Centralised input validation & sanitisation middleware.
 * Uses plain JS — no extra dependencies needed.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip HTML/script tags and trim whitespace */
function sanitizeStr(val) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').trim();
}

/** Return true if string is non-empty after sanitisation */
function required(val) {
  return sanitizeStr(val).length > 0;
}

// ── Order creation validator ───────────────────────────────────────────────

exports.validateCreateOrder = (req, res, next) => {
  const { shopName, shopKeeperName, phoneNumber, items } = req.body;
  const errors = [];

  // --- Header fields ---
  if (!required(shopName))       errors.push('shopName is required');
  if (!required(shopKeeperName)) errors.push('shopKeeperName is required');
  if (!required(phoneNumber))    errors.push('phoneNumber is required');

  // Phone: digits, spaces, dashes, plus — length 7-15
  const phone = sanitizeStr(phoneNumber);
  if (phone && !/^[+\d\s\-]{7,15}$/.test(phone)) {
    errors.push('phoneNumber format is invalid');
  }

  // --- Items ---
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('At least one order item is required');
  } else {
    items.forEach((item, i) => {
      const label = `items[${i}]`;
      if (!required(item.productName)) errors.push(`${label}.productName is required`);
      if (!required(item.variant))     errors.push(`${label}.variant is required`);

      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || qty < 1 || !Number.isInteger(qty)) {
        errors.push(`${label}.qty must be a positive integer`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' | '), errors });
  }

  // Sanitise before passing on — overwrite req.body with clean data
  req.body = {
    shopName:        sanitizeStr(shopName),
    shopKeeperName:  sanitizeStr(shopKeeperName),
    phoneNumber:     sanitizeStr(phoneNumber),
    items: items.map(item => ({
      productName: sanitizeStr(item.productName),
      variant:     sanitizeStr(item.variant),
      qty:         Math.floor(Number(item.qty)),
    })),
  };

  next();
};

// ── Summary / aggregation query validator ─────────────────────────────────

exports.validateSummaryQuery = (req, res, next) => {
  const { filter = 'today', from, to, page, limit } = req.query;

  const VALID_FILTERS = ['today', 'yesterday', 'week', 'custom', 'all'];
  if (!VALID_FILTERS.includes(filter)) {
    return res.status(400).json({ success: false, message: `filter must be one of: ${VALID_FILTERS.join(', ')}` });
  }

  if (filter === 'custom') {
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'from and to are required for custom filter' });
    }
    if (isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return res.status(400).json({ success: false, message: 'from and to must be valid dates (YYYY-MM-DD)' });
    }
    if (new Date(from) > new Date(to)) {
      return res.status(400).json({ success: false, message: '"from" date cannot be after "to" date' });
    }
  }

  // Pagination defaults
  req.pagination = {
    page:  Math.max(1, parseInt(page)  || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit) || 50)),
  };

  next();
};
