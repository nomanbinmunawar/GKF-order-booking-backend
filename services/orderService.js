/**
 * orderService.js
 * All MongoDB interactions for orders.
 * Controllers call these functions; no req/res here.
 */

const Order = require('../models/Order');

// ── Date range helpers ─────────────────────────────────────────────────────

function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Build a MongoDB date match object based on the filter string.
 * Reused by both list and aggregation queries.
 */
function buildDateMatch(filter, from, to) {
  const now = new Date();

  switch (filter) {
    case 'today': {
      const { start, end } = dayRange(now);
      return { date: { $gte: start, $lte: end } };
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const { start, end } = dayRange(y);
      return { date: { $gte: start, $lte: end } };
    }
    case 'week': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return { date: { $gte: startOfWeek, $lte: now } };
    }
    case 'custom': {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      return { date: { $gte: fromDate, $lte: toDate } };
    }
    default: // 'all'
      return {};
  }
}

// ── CRUD operations ────────────────────────────────────────────────────────

/**
 * List orders with pagination.
 * Returns { orders, total, page, totalPages }
 */
exports.listOrders = async ({ filter = 'today', from, to, page = 1, limit = 50 }) => {
  const match = buildDateMatch(filter, from, to);
  const skip  = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(match)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(match),
  ]);

  return {
    orders,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/** Get a single order by ID */
exports.getOrderById = async (id) => {
  return Order.findById(id).lean();
};

/** Create and persist a new order */
exports.createOrder = async ({ shopName, shopKeeperName, phoneNumber, items }) => {
  const order = new Order({
    shopName,
    shopKeeperName,
    phoneNumber,
    date: new Date(),
    items,
  });
  return order.save();
};

/** Delete an order by ID, returns the deleted doc or null */
exports.deleteOrder = async (id) => {
  return Order.findByIdAndDelete(id).lean();
};

// ── Aggregation: Summary ───────────────────────────────────────────────────

/**
 * Aggregate orders for a date range into a grouped summary.
 *
 * Returns an array like:
 * [
 *   {
 *     productName: "Laal Mirch",
 *     variants: [
 *       { variant: "100", totalQty: 15, orderCount: 3 },
 *       { variant: "200", totalQty: 8,  orderCount: 2 }
 *     ],
 *     grandTotalQty: 23
 *   }, ...
 * ]
 *
 * Also returns meta: { totalOrders, totalShops, periodLabel }
 */
exports.getSummary = async ({ filter = 'today', from, to }) => {
  const match = buildDateMatch(filter, from, to);

  // ── Stage pipeline ─────────────────────────────────────────────────────
  const pipeline = [
    // 1. Filter by date
    { $match: match },

    // 2. Unwind items array so each item becomes its own document
    { $unwind: '$items' },

    // 3. Group by product + variant → sum qty, count orders
    {
      $group: {
        _id: {
          productName: { $toLower: { $trim: { input: '$items.productName' } } },
          variant:     { $trim: { input: '$items.variant' } },
        },
        displayName: { $first: '$items.productName' },  // preserve original casing
        totalQty:    { $sum: '$items.qty' },
        orderCount:  { $sum: 1 },
      },
    },

    // 4. Sort variants numerically then by product name
    { $sort: { '_id.productName': 1, '_id.variant': 1 } },

    // 5. Re-group by product name, collecting variant rows
    {
      $group: {
        _id:         '$_id.productName',
        productName: { $first: '$displayName' },
        variants: {
          $push: {
            variant:    '$_id.variant',
            totalQty:   '$totalQty',
            orderCount: '$orderCount',
          },
        },
        grandTotalQty: { $sum: '$totalQty' },
      },
    },

    // 6. Final sort by product name
    { $sort: { productName: 1 } },
  ];

  // ── Meta pipeline (runs in parallel) ──────────────────────────────────
  const metaPipeline = [
    { $match: match },
    {
      $group: {
        _id:        null,
        totalOrders: { $sum: 1 },
        totalShops:  { $addToSet: '$shopName' },
      },
    },
    {
      $project: {
        _id:         0,
        totalOrders: 1,
        totalShops:  { $size: '$totalShops' },
      },
    },
  ];

  const [summary, metaArr] = await Promise.all([
    Order.aggregate(pipeline),
    Order.aggregate(metaPipeline),
  ]);

  const meta = metaArr[0] || { totalOrders: 0, totalShops: 0 };

  return { summary, meta };
};
