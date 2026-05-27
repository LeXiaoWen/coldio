const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data', 'coldio.db')

let db = null

function init() {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  try {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Verify integrity — auto-rebuild on corruption
    const row = db.pragma('integrity_check')
    if (row && row[0] && row[0].integrity_check !== 'ok') {
      console.warn('[db] corruption detected, rebuilding...')
      db.close()
      fs.renameSync(DB_PATH, DB_PATH + '.corrupted.' + Date.now())
      db = new Database(DB_PATH)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
    }
  } catch (e) {
    console.warn('[db] failed to open, rebuilding:', e.message)
    try { if (db) db.close() } catch {}
    try { fs.renameSync(DB_PATH, DB_PATH + '.corrupted.' + Date.now()) } catch {}
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      source TEXT NOT NULL,
      played_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listener_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      feedback_type TEXT NOT NULL,
      user_message TEXT,
      host_reply TEXT,
      slot_id TEXT,
      slot_title TEXT,
      track_title TEXT,
      track_artist TEXT,
      track_source TEXT,
      music_direction TEXT,
      scene TEXT,
      mood TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS daily_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weekday TEXT NOT NULL,
      host TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      source TEXT NOT NULL,
      plan_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)

  console.log('[db] initialized:', DB_PATH)
  return db
}

function getDb() {
  if (!db) throw new Error('DB not initialized. Call init() first.')
  return db
}

module.exports = { init, getDb }
