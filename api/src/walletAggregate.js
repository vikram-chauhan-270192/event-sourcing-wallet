function applyEvent(state, event) {
    switch (event.type) {
        case "WalletCreated":
            return { walletId: event.data.walletId, balance: 0, exists: true };

        case "WalletCredited":
            return { ...state, balance: state.balance + event.data.amount };

        case "WalletDebited":
            return { ...state, balance: state.balance - event.data.amount };

        default:
            return state;
    }
}

function rebuildWallet(events) {
    let state = { walletId: null, balance: 0, exists: false };

    for (const e of events) {
        state = applyEvent(state, e);
    }

    return state;
}

function validateCommand(state, command) {
    if (command.type === "CreateWallet") {
        if (state.exists) throw new Error("Wallet already exists");
        return;
    }

    if (!state.exists) throw new Error("Wallet does not exist");

    if (command.type === "CreditWallet") {
        if (command.amount <= 0) throw new Error("Amount must be > 0");
    }

    if (command.type === "DebitWallet") {
        if (command.amount <= 0) throw new Error("Amount must be > 0");
        if (state.balance < command.amount) throw new Error("Insufficient funds");
    }
}

function commandToEvent(command) {
    const now = new Date().toISOString();

    if (command.type === "CreateWallet") {
        return {
            type: "WalletCreated",
            data: { walletId: command.walletId },
            metadata: { createdAt: now },
        };
    }

    if (command.type === "CreditWallet") {
        return {
            type: "WalletCredited",
            data: { walletId: command.walletId, amount: command.amount },
            metadata: { createdAt: now },
        };
    }

    if (command.type === "DebitWallet") {
        return {
            type: "WalletDebited",
            data: { walletId: command.walletId, amount: command.amount },
            metadata: { createdAt: now },
        };
    }

    throw new Error("Unknown command type");
}

module.exports = { rebuildWallet, validateCommand, commandToEvent };
