const { Kafka } = require('kafkajs');
const Tracking = require('../models/Tracking');
const { kafkaMessagesProcessedTotal } = require('../metrics');

const kafka = new Kafka({
  clientId: 'tracking-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'tracking-service-group',
});

const handleOrderCreated = async (payload) => {
  const { orderId, customerId, createdAt, requestId } = payload;

  // Upsert — safe to re-process if Kafka delivers the message twice
  await Tracking.findOneAndUpdate(
    { orderId },
    {
      $setOnInsert: { orderId, customerId, currentStatus: 'CREATED' },
      $push: {
        timeline: { status: 'CREATED', note: 'Order placed', updatedBy: customerId, occurredAt: new Date(createdAt) },
      },
    },
    { upsert: true }
  );

  console.log(`[tracking] x-request-id:${requestId || 'n/a'} order created: ${orderId}`);
};

const handleStatusUpdated = async (payload) => {
  const { orderId, status, note, updatedBy, updatedAt, requestId } = payload;

  await Tracking.findOneAndUpdate(
    { orderId },
    {
      $set: { currentStatus: status },
      $push: {
        timeline: { status, note: note || '', updatedBy, occurredAt: new Date(updatedAt) },
      },
    }
  );

  console.log(`[tracking] x-request-id:${requestId || 'n/a'} order ${orderId} → ${status}`);
};

const HANDLERS = {
  'order.created':        handleOrderCreated,
  'order.status.updated': handleStatusUpdated,
};

const startConsumer = async () => {
  await consumer.connect();
  console.log('[tracking-service] Kafka consumer connected');

  await consumer.subscribe({
    topics: ['order.created', 'order.status.updated'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        const handler = HANDLERS[topic];
        if (handler) {
          await handler(payload);
          kafkaMessagesProcessedTotal.inc({ topic, service: 'tracking-service' });
        }
      } catch (err) {
        console.error(`[tracking] Failed to process message on ${topic}:`, err.message);
      }
    },
  });
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
};

module.exports = { startConsumer, disconnectConsumer };
