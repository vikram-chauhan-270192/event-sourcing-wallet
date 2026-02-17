const { Kafka } = require("kafkajs");

const kafka = new Kafka({
    clientId: "wallet-api",
    brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

async function connectProducer() {
    await producer.connect();
    console.log("✅ API Kafka producer connected");
}

async function publishEvent(event) {
    const topic = process.env.KAFKA_TOPIC;

    await producer.send({
        topic,
        messages: [
            {
                key: event.aggregateId,
                value: JSON.stringify(event),
            },
        ],
    });
}

module.exports = { connectProducer, publishEvent };
