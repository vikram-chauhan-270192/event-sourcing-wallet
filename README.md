https://chatgpt.com/share/6994a3c8-caec-800e-a7ee-8ad5c89578bf

# Event Sourcing + CQRS Demo (Express.js + Kafka KRaft + Postgres + Docker)

This repository is a complete working local example of:

- **Event Sourcing** (Postgres is the Event Store / source of truth)
- **CQRS** (a separate read model table is built by consuming events)
- **Kafka (KRaft mode)** as the event bus (no ZooKeeper)
- **Express.js** as the command API
- Everything runs locally using **Docker Compose**

---

## Table of Contents

1. What is Event Sourcing?
2. What is CQRS in this project?
3. Project Overview
4. Architecture (plain text)
5. Domain: Wallet
6. How the system works (end-to-end flow)
7. Running locally
8. Testing with curl
9. Inspecting Postgres tables
10. File-by-file explanation (every file)
11. Important concepts implemented
12. Known limitations (intentional)
13. Troubleshooting

---

## 1) What is Event Sourcing?

In a traditional CRUD system you store the latest state.

Example (CRUD style):

- Wallet table stores: `balance = 500`

If the wallet changes, you overwrite the balance.

---

### Event Sourcing approach

In Event Sourcing you store **immutable events** (facts) instead:

- WalletCreated
- WalletCredited
- WalletDebited

To get the current state, you **replay events** in order.

This gives:

- Full audit history
- Ability to rebuild state anytime
- Ability to create multiple read models later
- Easy integration with Kafka / streaming

---

## 2) What is CQRS in this project?

CQRS = Command Query Responsibility Segregation.

This project separates:

### Command Side (Write side)
- Express API accepts commands (create/credit/debit)
- Validates business rules
- Appends events to Postgres
- Publishes the event to Kafka

### Query Side (Read side)
- Kafka consumer reads events
- Updates a projection table in Postgres: `wallet_balances`
- Queries can read from this table instantly

---

## 3) Project Overview

This repo contains 4 running services:

1. **Postgres**
    - Stores event store table: `events`
    - Stores read model table: `wallet_balances`

2. **Kafka (KRaft mode)**
    - Receives published events from API
    - Delivers them to consumer(s)

3. **API (Express.js)**
    - Command service
    - Writes events + publishes to Kafka

4. **Consumer**
    - Reads events from Kafka
    - Builds the read model projection

---

## 4) Architecture (Plain Text)

Client -> HTTP -> Express API

Express API does two things:
1) Writes event to Postgres event store
2) Publishes event to Kafka topic

Kafka Consumer reads from Kafka topic and updates Postgres read model.

---

## 5) Domain: Wallet

This demo implements a simple wallet.

### Commands (incoming intent)
- CreateWallet(walletId)
- CreditWallet(walletId, amount)
- DebitWallet(walletId, amount)

### Events (facts stored forever)
- WalletCreated
- WalletCredited
- WalletDebited

---

## 6) End-to-End Flow (Important)

### Example: Credit wallet by 500

Step-by-step:

1. Client calls:
   POST /api/wallets/w1/credit { amount: 500 }

2. API loads all events for wallet w1 from Postgres

3. API rebuilds wallet state by replaying events:
    - WalletCreated -> balance 0
    - WalletCredited -> balance +500
      etc.

4. API validates business rules:
    - wallet exists
    - amount > 0

5. API appends a new event into Postgres:
    - aggregate_id = "w1"
    - version = previousVersion + 1
    - event_type = "WalletCredited"
    - event_data = { walletId: "w1", amount: 500 }

6. API publishes the same event to Kafka topic `wallet-events`

7. Consumer receives the event from Kafka

8. Consumer updates the projection table `wallet_balances`:
    - balance = balance + 500

---

## 7) Running Locally

### Start everything

From the root folder:

docker compose up --build

---

### Stop everything

docker compose down

---

### Stop and remove volumes (recommended while developing)

docker compose down -v

This is useful when:
- you changed db/init.sql
- you changed kafka cluster config
- you want a clean reset

---

## 8) Testing with curl

### 1) Create wallet

curl -X POST http://localhost:3000/api/wallets/w1

---

### 2) Credit wallet

curl -X POST http://localhost:3000/api/wallets/w1/credit \
-H "Content-Type: application/json" \
-d '{"amount": 500}'

---

### 3) Debit wallet

curl -X POST http://localhost:3000/api/wallets/w1/debit \
-H "Content-Type: application/json" \
-d '{"amount": 200}'

---

## 9) Inspecting Postgres Data

### Open Postgres shell

docker exec -it es_postgres psql -U esuser -d esdb

---

### See events

SELECT id, aggregate_id, version, event_type, event_data, created_at
FROM events
ORDER BY id;

---

### See projection

SELECT * FROM wallet_balances;

---

## 10) Project Structure

event-sourcing-wallet/
docker-compose.yml
db/
init.sql
api/
Dockerfile
package.json
src/
index.js
db.js
kafka.js
eventStore.js
walletAggregate.js
routes.js
consumer/
Dockerfile
package.json
src/
index.js
db.js
kafka.js
projector.js

---

# 11) File-by-file Explanation (Every File)

This section explains exactly what each file does.

---

## docker-compose.yml

Purpose:
- Starts all services required for the demo locally.

Services:

### postgres
- Runs Postgres 16
- Loads schema from db/init.sql
- Exposes port 5432
- Healthcheck ensures DB is ready before API starts

### kafka
- Runs Confluent Kafka in KRaft mode
- Exposes port 9092
- Healthcheck ensures Kafka is ready before API/consumer start

### api
- Builds from ./api
- Runs Express command service
- Exposes port 3000
- Depends on healthy Postgres + Kafka

### consumer
- Builds from ./consumer
- Runs Kafka consumer (projection builder)
- Depends on healthy Postgres + Kafka

---

## db/init.sql

Purpose:
- Creates the Postgres schema.

Tables:

### events
This is the Event Store table.

Key columns:
- id: global sequence
- aggregate_id: wallet id
- aggregate_type: "Wallet"
- version: per-wallet version (1,2,3...)
- event_type: "WalletCredited"
- event_data: JSON payload
- metadata: JSON metadata
- created_at: timestamp

Important constraint:
- UNIQUE (aggregate_id, version)

This prevents two writes from creating the same version.

---

### wallet_balances
This is the read model projection table.

Columns:
- wallet_id: primary key
- balance: computed balance
- updated_at: last projection update time

This table is NOT the source of truth.
It is derived from the events.

---

# API Service (Express)

---

## api/Dockerfile

Purpose:
- Builds the API container image.

Steps:
- Uses node:20-alpine
- Copies package.json
- Installs dependencies
- Copies src/
- Runs npm start

---

## api/package.json

Purpose:
- Defines API dependencies and start command.

Important dependencies:
- express: HTTP server
- pg: Postgres client
- kafkajs: Kafka producer

---

## api/src/index.js

Purpose:
- Main entrypoint for the API service.

Responsibilities:
- Create Express app
- Register JSON middleware
- Register routes from routes.js
- Connect Kafka producer
- Start server on port 3000

---

## api/src/db.js

Purpose:
- Creates a Postgres connection pool.

Used by:
- eventStore.js

---

## api/src/kafka.js

Purpose:
- Kafka producer helper.

Responsibilities:
- Connect producer
- Publish events to Kafka topic

Important detail:
- Uses aggregateId as Kafka message key
  This ensures ordering per wallet.

---

## api/src/eventStore.js

Purpose:
- Implements event store operations.

Functions:

### loadEvents(aggregateId)
- Loads all events for one aggregate (wallet)
- Returns them ordered by version ascending

### appendEvent(...)
- Appends a new event
- Implements optimistic concurrency:
    1. Reads last version from DB
    2. Compares to expectedVersion
    3. Inserts event with version = expectedVersion + 1
    4. Commits transaction

If the expectedVersion does not match, it throws a concurrency error.

---

## api/src/walletAggregate.js

Purpose:
- Implements the wallet aggregate rules and state rebuild.

Functions:

### applyEvent(state, event)
Updates state based on event type:
- WalletCreated -> exists=true, balance=0
- WalletCredited -> balance += amount
- WalletDebited -> balance -= amount

### rebuildWallet(events)
Starts from initial empty state and applies events in order.

### validateCommand(state, command)
Business rules:
- cannot create wallet twice
- cannot credit/debit a wallet that doesn't exist
- cannot debit more than current balance
- amount must be > 0

### commandToEvent(command)
Maps a command to the event object.

---

## api/src/routes.js

Purpose:
- Defines Express routes for commands.

Routes:

### POST /api/wallets/:id
Creates wallet.

### POST /api/wallets/:id/credit
Credits wallet.

### POST /api/wallets/:id/debit
Debits wallet.

Each route follows the same event sourcing workflow:
1. loadEvents
2. rebuildWallet
3. validateCommand
4. appendEvent to Postgres
5. publishEvent to Kafka

---

# Consumer Service (Projection Builder)

---

## consumer/Dockerfile

Purpose:
- Builds the consumer container.

---

## consumer/package.json

Purpose:
- Defines dependencies and start script.

Dependencies:
- kafkajs
- pg

---

## consumer/src/index.js

Purpose:
- Main entrypoint of the consumer.

Responsibilities:
- Connect Kafka consumer
- Subscribe to topic wallet-events
- Process each message
- Parse JSON event
- Call projector.js

---

## consumer/src/db.js

Purpose:
- Postgres pool for consumer.

Used by:
- projector.js

---

## consumer/src/kafka.js

Purpose:
- Kafka consumer configuration.

Important:
- Uses a groupId (wallet-projector)
- Allows multiple consumers to scale horizontally

---

## consumer/src/projector.js

Purpose:
- Builds the read model projection.

Function:

### project(event)
For each event type:

- WalletCreated:
  Inserts wallet row if missing

- WalletCredited:
  Increments balance

- WalletDebited:
  Decrements balance

This keeps `wallet_balances` always updated.

---

# 12) Important Concepts Implemented

## Optimistic Concurrency
Events are versioned per aggregate.

If two requests try to write at the same time:
- one succeeds
- one fails with concurrency conflict

---

## Kafka Ordering
Events are published with key = aggregateId.
Kafka guarantees ordering per key.

So wallet w1 events stay in correct order.

---

## Projection (Read Model)
Reads do not replay events.
They query a fast table.

This is the CQRS pattern.

---

# 13) Known Limitations (Intentional)

This demo is minimal and focuses on learning.

Production systems usually add:

## Outbox Pattern
Guarantees:
- event stored in DB
- event published to Kafka
  atomically.

## Idempotency
Kafka can redeliver messages.
Projection must be able to safely re-process events.

## Snapshots
Replaying too many events becomes slow.
Snapshots store state checkpoints.

## DLQ (Dead Letter Queue)
Failed events go to a separate topic for investigation.

---

# 14) Troubleshooting

## Postgres container exits immediately
Check logs:

docker logs es_postgres --tail=200

Common fix:
docker compose down -v
docker compose up --build

---

## Kafka container not healthy
Check logs:

docker logs es_kafka --tail=200

Common fix:
docker compose down -v
docker compose up --build

---

## API cannot connect to Kafka
Ensure env values are correct:
- KAFKA_BROKER=kafka:9092
- topic auto-create enabled (dev)

---

# 15) License
MIT (or choose your own)
