const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const { publishEvent } = require('../kafka/producer');

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// Valid status transitions — prevents arbitrary jumps (e.g. DELIVERED → IN_TRANSIT)
const TRANSITIONS = {
  CREATED:          ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:         ['PICKED_UP', 'CANCELLED'],
  PICKED_UP:        ['IN_TRANSIT'],
  IN_TRANSIT:       ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED:        [],
  CANCELLED:        [],
};

// ─── POST /orders ────────────────────────────────────────────────────────────
// Customer creates a new shipment order

router.post(
  '/',
  [
    body('origin.address').trim().notEmpty().withMessage('Origin address is required'),
    body('origin.city').trim().notEmpty().withMessage('Origin city is required'),
    body('origin.pincode').trim().notEmpty().withMessage('Origin pincode is required'),
    body('destination.address').trim().notEmpty().withMessage('Destination address is required'),
    body('destination.city').trim().notEmpty().withMessage('Destination city is required'),
    body('destination.pincode').trim().notEmpty().withMessage('Destination pincode is required'),
    body('packageDetails.weight').isFloat({ gt: 0 }).withMessage('Package weight must be greater than 0'),
    body('packageDetails.description').optional().trim(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    // Only customers can place orders
    if (userRole !== 'CUSTOMER') {
      return res.status(403).json({ message: 'Only customers can create orders' });
    }

    try {
      const order = await Order.create({
        customerId: userId,
        customerEmail: req.body.customerEmail || null,
        origin: req.body.origin,
        destination: req.body.destination,
        packageDetails: req.body.packageDetails,
        statusHistory: [{ status: 'CREATED', updatedBy: userId, note: 'Order placed' }],
      });

      await publishEvent('order.created', {
        orderId: order._id,
        customerId: order.customerId,
        customerEmail: req.body.customerEmail || null,
        status: 'CREATED',
        origin: order.origin,
        destination: order.destination,
        createdAt: order.createdAt,
      });

      return res.status(201).json({ message: 'Order created successfully', order });
    } catch (err) {
      console.error('[POST /orders]', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── GET /orders ─────────────────────────────────────────────────────────────
// Customer sees own orders. Agent sees assigned orders. Admin sees all.

router.get('/', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  try {
    let filter = {};
    if (userRole === 'CUSTOMER') filter = { customerId: userId };
    else if (userRole === 'AGENT') filter = { agentId: userId };
    // ADMIN: no filter — sees everything

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (err) {
    console.error('[GET /orders]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── GET /orders/:id ─────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Customers can only view their own orders
    if (userRole === 'CUSTOMER' && order.customerId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({ order });
  } catch (err) {
    console.error('[GET /orders/:id]', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ─── PATCH /orders/:id/status ────────────────────────────────────────────────
// Agent updates status. Admin can also update. Customers cannot.

router.patch(
  '/:id/status',
  [
    body('status').notEmpty().withMessage('Status is required'),
    body('note').optional().trim(),
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (userRole === 'CUSTOMER') {
      return res.status(403).json({ message: 'Customers cannot update order status' });
    }

    const { status, note } = req.body;

    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      // Agents can only update orders assigned to them
      if (userRole === 'AGENT' && order.agentId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Enforce valid transition
      const allowed = TRANSITIONS[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Cannot transition from ${order.status} to ${status}`,
          allowed,
        });
      }

      order.status = status;
      order.statusHistory.push({ status, updatedBy: userId, note: note || '' });
      await order.save();

      await publishEvent('order.status.updated', {
        orderId: order._id,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        agentId: order.agentId,
        status,
        note: note || '',
        updatedBy: userId,
        updatedAt: new Date(),
      });

      return res.json({ message: 'Order status updated', order });
    } catch (err) {
      console.error('[PATCH /orders/:id/status]', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// ─── PATCH /orders/:id/assign ────────────────────────────────────────────────
// Admin assigns an agent to an order

router.patch(
  '/:id/assign',
  [body('agentId').notEmpty().withMessage('agentId is required')],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can assign agents' });
    }

    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (order.status !== 'CREATED') {
        return res.status(400).json({ message: 'Only CREATED orders can be assigned' });
      }

      order.agentId = req.body.agentId;
      order.status = 'ASSIGNED';
      order.statusHistory.push({ status: 'ASSIGNED', updatedBy: userId, note: `Assigned to agent ${req.body.agentId}` });
      await order.save();

      // Publish to both topics — order.assigned for analytics,
      // order.status.updated so tracking + notification pick up the ASSIGNED status
      await publishEvent('order.assigned', {
        orderId:       order._id,
        customerId:    order.customerId,
        customerEmail: order.customerEmail,
        agentId:       order.agentId,
        status:        'ASSIGNED',
        assignedAt:    new Date(),
      });

      await publishEvent('order.status.updated', {
        orderId:       order._id,
        customerId:    order.customerId,
        customerEmail: order.customerEmail,
        agentId:       order.agentId,
        status:        'ASSIGNED',
        note:          `Assigned to agent ${req.body.agentId}`,
        updatedBy:     userId,
        updatedAt:     new Date(),
      });

      return res.json({ message: 'Agent assigned successfully', order });
    } catch (err) {
      console.error('[PATCH /orders/:id/assign]', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

module.exports = router;
