/**
 * routes/orders.js
 * Clean route definitions — validation middleware → controller.
 * No business logic here.
 */

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/orderController');
const { validateCreateOrder, validateSummaryQuery } = require('../middleware/validate');

// Aggregated summary — MUST come before /:id to avoid route collision
router.get('/summary', validateSummaryQuery, ctrl.summary);

// List orders (paginated, filterable)
router.get('/',        validateSummaryQuery, ctrl.list);

// Single order
router.get('/:id',     ctrl.getOne);

// Create order
router.post('/',       validateCreateOrder,  ctrl.create);

// Delete order
router.delete('/:id',  ctrl.remove);

module.exports = router;
