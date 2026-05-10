const { Kafka } = require('kafkajs');
const OrderEvent = require('../models/OrderEvent');

const kafka = new Kafka({
  clientId: 'analytics-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'analytics-service-group',
});

const recordEvent = async (topic, payload) => {
  const { orderId, customerId, agentId, status, createdAt, updatedAt } = payload;

  await OrderEvent.create({
    orderId,
    customerId,
    agentId:    agentId || null,
    event:      topic,
    status:     status || 'CREATED',
    occurredAt: new Date(updatedAt || createdAt || Date.now()),
  });

  console.log(`[analytics] Recorded event: ${topic} → order ${orderId} (${status || 'CREATED'})`);
};

const startConsumer = async () => {
  await consumer.connect();
  console.log('[analytics-service] Kafka consumer connected');

  await consumer.subscribe({
    topics: ['order.created', 'order.status.updated', 'order.assigned'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await recordEvent(topic, payload);
      } catch (err) {
        console.error(`[analytics] Failed to process message on ${topic}:`, err.message);
      }
    },
  });
};

const disconnectConsumer = async () => {
  await consumer.disconnect();
};

module.exports = { startConsumer, disconnectConsumer };
