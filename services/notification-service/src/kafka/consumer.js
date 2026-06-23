const { Kafka } = require('kafkajs');
const { sendMail } = require('../mailer/transporter');
const { getTemplate } = require('../mailer/templates');
const NotificationLog = require('../models/NotificationLog');
const { kafkaMessagesProcessedTotal } = require('../metrics');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
});

// Resolve customer email — in a real system this would call auth-service or a user cache.
// For now we read from the event payload (order-service should include customerEmail).
const resolveEmail = (payload) => payload.customerEmail || null;

const processEvent = async (topic, payload) => {
  const { orderId, customerId, status } = payload;
  const customerEmail = resolveEmail(payload);

  if (!customerEmail) {
    console.warn(`[notification] No email in payload for order ${orderId} — skipping`);
    return;
  }

  const template = getTemplate(status, orderId);
  if (!template) return; // status doesn't warrant a notification

  let success = false;
  let error = null;

  try {
    await sendMail({ to: customerEmail, ...template });
    success = true;
    console.log(`[notification] Email sent → ${customerEmail} for order ${orderId} (${status})`);
  } catch (err) {
    error = err.message;
    console.error(`[notification] Failed to send email for order ${orderId}:`, err.message);
  }

  // Log every attempt regardless of outcome
  await NotificationLog.create({
    orderId,
    customerId,
    event: topic,
    status,
    recipient: customerEmail,
    subject: template.subject,
    success,
    error,
  });
};

const startConsumer = async () => {
  await consumer.connect();
  console.log('[notification-service] Kafka consumer connected');

  await consumer.subscribe({
    topics: ['order.created', 'order.status.updated'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await processEvent(topic, payload);
        kafkaMessagesProcessedTotal.inc({ topic, service: 'notification-service' });
      } catch (err) {
        console.error(`[notification] Failed to process message on ${topic}:`, err.message);
      }
    },
  });
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
};

module.exports = { startConsumer, disconnectConsumer };
