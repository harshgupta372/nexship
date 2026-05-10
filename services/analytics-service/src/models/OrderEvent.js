const mongoose = require('mongoose');

// Raw event log — every Kafka event lands here first.
// Aggregations are computed on-the-fly from this collection.
const orderEventSchema = new mongoose.Schema(
  {
    orderId:    { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    agentId:    { type: String, default: null },
    event:      { type: String, required: true }, // topic name
    status:     { type: String, required: true },
    occurredAt: { type: Date,   required: true },
  },
  { timestamps: true }
);

// Compound index — fast lookups per order and per agent
orderEventSchema.index({ orderId: 1, status: 1 });
orderEventSchema.index({ agentId: 1, status: 1 });

module.exports = mongoose.model('OrderEvent', orderEventSchema);
