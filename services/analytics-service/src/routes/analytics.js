const express = require('express');
const OrderEvent = require('../models/OrderEvent');

const router = express.Router();

// All analytics endpoints are admin-only
const requireAdmin = (req, res, next) => {
  if (req.headers['x-user-role'] !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

// ─── GET /analytics/summary ───────────────────────────────────────────────────
// Total orders, delivery rate, cancellation rate

router.get('/summary', async (req, res) => {
  try {
    const [total, delivered, cancelled] = await Promise.all([
      OrderEvent.distinct('orderId').then(ids => ids.length),
      OrderEvent.distinct('orderId', { status: 'DELIVERED' }).then(ids => ids.length),
      OrderEvent.distinct('orderId', { status: 'CANCELLED' }).then(ids => ids.length),
    ]);

    const deliveryRate   = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0';
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0';

    return res.json({
      totalOrders: total,
      delivered,
      cancelled,
      inProgress: total - delivered - cancelled,
      deliveryRate:     `${deliveryRate}%`,
      cancellationRate: `${cancellationRate}%`,
    });
  } catch (err) {
    console.error('[GET /analytics/summary]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /analytics/avg-delivery-time ────────────────────────────────────────
// Average time from CREATED to DELIVERED (in hours)

router.get('/avg-delivery-time', async (req, res) => {
  try {
    const result = await OrderEvent.aggregate([
      { $match: { status: { $in: ['CREATED', 'DELIVERED'] } } },
      { $sort: { orderId: 1, occurredAt: 1 } },
      {
        $group: {
          _id: '$orderId',
          events: { $push: { status: '$status', occurredAt: '$occurredAt' } },
        },
      },
      {
        $project: {
          createdAt:   { $arrayElemAt: [{ $filter: { input: '$events', as: 'e', cond: { $eq: ['$$e.status', 'CREATED'] } } }, 0] },
          deliveredAt: { $arrayElemAt: [{ $filter: { input: '$events', as: 'e', cond: { $eq: ['$$e.status', 'DELIVERED'] } } }, 0] },
        },
      },
      {
        $match: {
          'createdAt.occurredAt':   { $exists: true },
          'deliveredAt.occurredAt': { $exists: true },
        },
      },
      {
        $project: {
          durationMs: {
            $subtract: ['$deliveredAt.occurredAt', '$createdAt.occurredAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: '$durationMs' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!result.length) {
      return res.json({ avgDeliveryTimeHours: null, basedOn: 0 });
    }

    const avgHours = (result[0].avgDurationMs / (1000 * 60 * 60)).toFixed(2);
    return res.json({ avgDeliveryTimeHours: Number(avgHours), basedOn: result[0].count });
  } catch (err) {
    console.error('[GET /analytics/avg-delivery-time]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /analytics/orders-by-status ─────────────────────────────────────────
// Count of orders currently at each status

router.get('/orders-by-status', async (req, res) => {
  try {
    // Get the latest status event per order, then group by that status
    const result = await OrderEvent.aggregate([
      { $sort: { orderId: 1, occurredAt: -1 } },
      { $group: { _id: '$orderId', latestStatus: { $first: '$status' } } },
      { $group: { _id: '$latestStatus', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);

    return res.json({ breakdown: result });
  } catch (err) {
    console.error('[GET /analytics/orders-by-status]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /analytics/agent-performance ────────────────────────────────────────
// Per-agent: total assigned, delivered, and delivery rate

router.get('/agent-performance', async (req, res) => {
  try {
    const result = await OrderEvent.aggregate([
      { $match: { agentId: { $ne: null }, status: { $in: ['ASSIGNED', 'DELIVERED', 'CANCELLED'] } } },
      {
        $group: {
          _id: { agentId: '$agentId', status: '$status' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.agentId',
          statusCounts: { $push: { status: '$_id.status', count: '$count' } },
        },
      },
      {
        $project: {
          agentId: '$_id',
          assigned:  { $sum: { $map: { input: { $filter: { input: '$statusCounts', as: 's', cond: { $eq: ['$$s.status', 'ASSIGNED'] } } }, as: 'x', in: '$$x.count' } } },
          delivered: { $sum: { $map: { input: { $filter: { input: '$statusCounts', as: 's', cond: { $eq: ['$$s.status', 'DELIVERED'] } } }, as: 'x', in: '$$x.count' } } },
          cancelled: { $sum: { $map: { input: { $filter: { input: '$statusCounts', as: 's', cond: { $eq: ['$$s.status', 'CANCELLED'] } } }, as: 'x', in: '$$x.count' } } },
          _id: 0,
        },
      },
      { $sort: { delivered: -1 } },
    ]);

    return res.json({ agents: result });
  } catch (err) {
    console.error('[GET /analytics/agent-performance]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /analytics/daily-orders ─────────────────────────────────────────────
// Orders created per day — for trend charts

router.get('/daily-orders', async (req, res) => {
  try {
    const result = await OrderEvent.aggregate([
      { $match: { status: 'CREATED' } },
      {
        $group: {
          _id: {
            year:  { $year: '$occurredAt' },
            month: { $month: '$occurredAt' },
            day:   { $dayOfMonth: '$occurredAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      {
        $project: {
          date: {
            $dateFromParts: { year: '$_id.year', month: '$_id.month', day: '$_id.day' },
          },
          count: 1,
          _id: 0,
        },
      },
    ]);

    return res.json({ dailyOrders: result });
  } catch (err) {
    console.error('[GET /analytics/daily-orders]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
