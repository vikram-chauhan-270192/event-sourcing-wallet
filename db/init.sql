CREATE TABLE IF NOT EXISTS events (
                                      id BIGSERIAL PRIMARY KEY,
                                      aggregate_id TEXT NOT NULL,
                                      aggregate_type TEXT NOT NULL,
                                      version INT NOT NULL,
                                      event_type TEXT NOT NULL,
                                      event_data JSONB NOT NULL,
                                      metadata JSONB NOT NULL,
                                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (aggregate_id, version)
    );

CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);

-- Read model / projection
CREATE TABLE IF NOT EXISTS wallet_balances (
                                               wallet_id TEXT PRIMARY KEY,
                                               balance BIGINT NOT NULL DEFAULT 0,
                                               updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
