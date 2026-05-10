const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    updatedBy: { type: String, required: true }, // userId from x-user-id header
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    customerEmail: {
      type: String,
      default: null,
    },
    agentId: {
      type: String,
      default: null,
      index: true,
    },
    origin: {
      address: { type: String, required: true },
      city:    { type: String, required: true },
      pincode: { type: String, required: true },
    },
    destination: {
      address: { type: String, required: true },
      city:    { type: String, required: true },
      pincode: { type: String, required: true },
    },
    packageDetails: {
      weight:      { type: Number, required: true }, // kg
      description: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'CREATED',
    },
    // Full audit trail — every status change appended here
    statusHistory: [statusHistorySchema],
    estimatedDelivery: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
