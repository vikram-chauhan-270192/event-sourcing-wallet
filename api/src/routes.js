const express = require("express");
const { loadEvents, appendEvent } = require("./eventStore");
const { rebuildWallet, validateCommand, commandToEvent } = require("./walletAggregate");
const { publishEvent } = require("./kafka");

const router = express.Router();

router.post("/wallets/:id", async (req, res) => {
    try {
        const walletId = req.params.id;

        const events = await loadEvents(walletId);
        const state = rebuildWallet(events);

        const command = { type: "CreateWallet", walletId };
        validateCommand(state, command);

        const expectedVersion = events.length ? events[events.length - 1].version : 0;

        const ev = commandToEvent(command);

        const stored = await appendEvent({
            aggregateId: walletId,
            aggregateType: "Wallet",
            expectedVersion,
            eventType: ev.type,
            eventData: ev.data,
            metadata: ev.metadata,
        });

        await publishEvent(stored);

        res.json({ ok: true, event: stored });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

router.post("/wallets/:id/credit", async (req, res) => {
    try {
        const walletId = req.params.id;
        const amount = Number(req.body.amount);

        const events = await loadEvents(walletId);
        const state = rebuildWallet(events);

        const command = { type: "CreditWallet", walletId, amount };
        validateCommand(state, command);

        const expectedVersion = events.length ? events[events.length - 1].version : 0;
        const ev = commandToEvent(command);

        const stored = await appendEvent({
            aggregateId: walletId,
            aggregateType: "Wallet",
            expectedVersion,
            eventType: ev.type,
            eventData: ev.data,
            metadata: ev.metadata,
        });

        await publishEvent(stored);

        res.json({ ok: true, event: stored });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

router.post("/wallets/:id/debit", async (req, res) => {
    try {
        const walletId = req.params.id;
        const amount = Number(req.body.amount);

        const events = await loadEvents(walletId);
        const state = rebuildWallet(events);

        const command = { type: "DebitWallet", walletId, amount };
        validateCommand(state, command);

        const expectedVersion = events.length ? events[events.length - 1].version : 0;
        const ev = commandToEvent(command);

        const stored = await appendEvent({
            aggregateId: walletId,
            aggregateType: "Wallet",
            expectedVersion,
            eventType: ev.type,
            eventData: ev.data,
            metadata: ev.metadata,
        });

        await publishEvent(stored);

        res.json({ ok: true, event: stored });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

module.exports = { router };
