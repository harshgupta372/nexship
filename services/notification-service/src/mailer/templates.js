const templates = {
  CREATED: (orderId) => ({
    subject: 'Your NexShip order has been placed!',
    html: `
      <h2>Order Confirmed</h2>
      <p>Your shipment order <strong>#${orderId}</strong> has been successfully placed.</p>
      <p>We'll notify you as soon as a delivery agent is assigned.</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),

  ASSIGNED: (orderId) => ({
    subject: 'A delivery agent has been assigned to your order',
    html: `
      <h2>Agent Assigned</h2>
      <p>Good news! A delivery agent has been assigned to your shipment <strong>#${orderId}</strong>.</p>
      <p>Your package will be picked up shortly.</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),

  PICKED_UP: (orderId) => ({
    subject: 'Your package has been picked up',
    html: `
      <h2>Package Picked Up</h2>
      <p>Your shipment <strong>#${orderId}</strong> has been picked up by the delivery agent and is on its way.</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),

  OUT_FOR_DELIVERY: (orderId) => ({
    subject: 'Your package is out for delivery today!',
    html: `
      <h2>Out for Delivery</h2>
      <p>Your shipment <strong>#${orderId}</strong> is out for delivery and will arrive today.</p>
      <p>Please ensure someone is available to receive it.</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),

  DELIVERED: (orderId) => ({
    subject: 'Your package has been delivered!',
    html: `
      <h2>Delivered!</h2>
      <p>Your shipment <strong>#${orderId}</strong> has been successfully delivered.</p>
      <p>Thank you for choosing NexShip!</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),

  CANCELLED: (orderId) => ({
    subject: 'Your NexShip order has been cancelled',
    html: `
      <h2>Order Cancelled</h2>
      <p>Your shipment <strong>#${orderId}</strong> has been cancelled.</p>
      <p>If you have any questions, please contact our support team.</p>
      <br/><p>— The NexShip Team</p>
    `,
  }),
};

// Not every status needs an email — only these trigger a notification
const NOTIFY_ON = new Set(['CREATED', 'ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);

const getTemplate = (status, orderId) => {
  if (!NOTIFY_ON.has(status)) return null;
  return templates[status]?.(orderId) || null;
};

module.exports = { getTemplate };
