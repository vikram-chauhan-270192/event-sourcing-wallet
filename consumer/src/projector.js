const { consumer, connectConsumer } = require("./kafka");
const { project } = require("./projector");

async function start() {
    await connectConsumer();

    const topic = process.env.KAFKA_TOPIC;

    await consumer.subscribe({ topic, fromBeginning: true });

    console.log(`📥 Listening to topic: ${topic}`);

    await consumer.run({
        eachMessage: async ({ message }) => {
            const raw = message.value.toString();
            const event = JSON.parse(raw);

            console.log("➡️ Event received:", event.type, event.aggregateId, "v" + event.version);

            await project(event);

            console.log("✅ Projected:", event.type);
        },
    });
}

start().catch((err) => {
    console.error("Consumer fatal error:", err);
    process.exit(1);
});
