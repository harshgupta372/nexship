const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note:   { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    occurredAt: { type: Date, required: true },
  },
  { _id: false }
);

const trackingSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    currentStatus: {
      type: String,
      default: 'CREATED',
    },
    // Append-only log — one entry per status change
    timeline: [eventSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tracking', trackingSchema);
