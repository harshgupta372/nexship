const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'kafka:9092').split(','),
});

const producer = kafka.producer();

const connectProducer = async () => {
  await producer.connect();
  console.log('[order-service] Kafka producer connected');
};

const publishEvent = async (topic, payload) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(payload) }],
  });
};

const disconnectProducer = async () => {
  await producer.disconnect();
};

module.exports = { connectProducer, publishEvent, disconnectProducer };
