/**
 * orderController.js
 * Handles HTTP concerns only; delegates all business logic to orderService.
 */

const orderService = require('../services/orderService');

// GET /api/orders
exports.list = async (req, res, next) => {
  try {
    const { filter = 'today', from, to } = req.query;
    const { page, limit } = req.pagination;

    const result = await orderService.listOrders({ filter, from, to, page, limit });

    res.json({
      success: true,
      count:      result.orders.length,
      total:      result.total,
      page:       result.page,
      totalPages: result.totalPages,
      data:       result.orders,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/summary
exports.summary = async (req, res, next) => {
  try {
    const { filter = 'today', from, to } = req.query;
    const result = await orderService.getSummary({ filter, from, to });

    res.json({
      success: true,
      filter,
      meta:    result.meta,
      data:    result.summary,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
exports.getOne = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

// POST /api/orders
exports.create = async (req, res, next) => {
  try {
    const saved = await orderService.createOrder(req.body);
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/orders/:id
exports.remove = async (req, res, next) => {
  try {
    const order = await orderService.deleteOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};
