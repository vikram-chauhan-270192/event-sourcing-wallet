const { Kafka } = require("kafkajs");

const kafka = new Kafka({
    clientId: "wallet-projector",
    brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP });

async function connectConsumer() {
    await consumer.connect();
    console.log("✅ Consumer connected to Kafka");
}

module.exports = { consumer, connectConsumer };
