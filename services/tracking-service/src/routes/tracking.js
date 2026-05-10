const express = require('express');
const Tracking = require('../models/Tracking');

const router = express.Router();

// ─── GET /tracking/:orderId ───────────────────────────────────────────────────
// Returns full timeline for an order.
// Customer can only view their own order's timeline.
// Agent and Admin can view any.

router.get('/:orderId', async (req, res) => {
  const userId   = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  try {
    const record = await Tracking.findOne({ orderId: req.params.orderId });
    if (!record) return res.status(404).json({ message: 'Tracking record not found' });

    if (userRole === 'CUSTOMER' && record.customerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      orderId:       record.orderId,
      currentStatus: record.currentStatus,
      timeline:      record.timeline,
      lastUpdated:   record.updatedAt,
    });
  } catch (err) {
    console.error('[GET /tracking/:orderId]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
