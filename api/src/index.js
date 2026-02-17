const express = require("express");
const { connectProducer } = require("./kafka");
const { router } = require("./routes");

const app = express();
app.use(express.json());

app.use("/api", router);

app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;

async function start() {
    await connectProducer();

    app.listen(port, () => {
        console.log(`🚀 API running on http://localhost:${port}`);
    });
}

start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
