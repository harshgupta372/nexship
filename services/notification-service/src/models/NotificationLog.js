const mongoose = require('mongoose');

// Keeps a record of every email sent — useful for debugging and audit
const notificationLogSchema = new mongoose.Schema(
  {
    orderId:    { type: String, required: true, index: true },
    customerId: { type: String, required: true },
    event:      { type: String, required: true }, // e.g. 'order.created'
    status:     { type: String, required: true }, // order status that triggered this
    recipient:  { type: String, required: true }, // email address
    subject:    { type: String, required: true },
    sentAt:     { type: Date, default: Date.now },
    success:    { type: Boolean, required: true },
    error:      { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
