const { Client } = require('pg');
const log = require('electron-log');

async function testDb({ localPort, dbName, dbUser, dbPassword }) {
  const client = new Client({
    host: '127.0.0.1',
    port: localPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 10000,
    connectionTimeoutMillis: 10000
  });
  try {
    await client.connect();
    const r = await client.query('SELECT 1 as ok');
    return { success: true, ok: r.rows[0].ok === 1 };
  } catch (err) {
    log.error('DB test error', err.message);
    return { success: false, error: err.message };
  } finally {
    try { await client.end(); } catch (_) { /* ignore */ }
  }
}

module.exports = { testDb };
