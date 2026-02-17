const { pool } = require("./db");

/**
 * Loads all events for aggregate_id ordered by version.
 */
async function loadEvents(aggregateId) {
    const { rows } = await pool.query(
        `SELECT * FROM events
     WHERE aggregate_id = $1
     ORDER BY version ASC`,
        [aggregateId]
    );

    return rows.map((r) => ({
        aggregateId: r.aggregate_id,
        aggregateType: r.aggregate_type,
        version: r.version,
        type: r.event_type,
        data: r.event_data,
        metadata: r.metadata,
        createdAt: r.created_at,
    }));
}

/**
 * Append a new event with optimistic concurrency:
 * expectedVersion must match the last version.
 */
async function appendEvent({
                               aggregateId,
                               aggregateType,
                               expectedVersion,
                               eventType,
                               eventData,
                               metadata,
                           }) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const last = await client.query(
            `SELECT version FROM events
       WHERE aggregate_id = $1
       ORDER BY version DESC
       LIMIT 1`,
            [aggregateId]
        );

        const lastVersion = last.rows.length ? last.rows[0].version : 0;

        if (lastVersion !== expectedVersion) {
            throw new Error(
                `Concurrency conflict: expected=${expectedVersion}, actual=${lastVersion}`
            );
        }

        const newVersion = expectedVersion + 1;

        const insert = await client.query(
            `INSERT INTO events
        (aggregate_id, aggregate_type, version, event_type, event_data, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [
                aggregateId,
                aggregateType,
                newVersion,
                eventType,
                eventData,
                metadata,
            ]
        );

        await client.query("COMMIT");

        const row = insert.rows[0];

        return {
            aggregateId: row.aggregate_id,
            aggregateType: row.aggregate_type,
            version: row.version,
            type: row.event_type,
            data: row.event_data,
            metadata: row.metadata,
            createdAt: row.created_at,
        };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { loadEvents, appendEvent };
