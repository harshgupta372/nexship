const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'nexship_node_' });

const kafkaMessagesProcessedTotal = new client.Counter({
  name: 'nexship_kafka_messages_processed_total',
  help: 'Kafka messages successfully processed',
  labelNames: ['topic', 'service'],
  registers: [register],
});

module.exports = { register, kafkaMessagesProcessedTotal };
