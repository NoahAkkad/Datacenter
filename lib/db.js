const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'db.json');

const base = {
  users: [],
  companies: [],
  applications: [],
  fields: [],
  records: []
};

function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.DATABASE_URL?.startsWith('file://')) return process.env.DATABASE_URL.replace('file://', '');
  return DEFAULT_DB_PATH;
}

function getDbCache() {
  if (!global.__datacenterDb) {
    global.__datacenterDb = { conn: null, promise: null };
  }
  return global.__datacenterDb;
}

async function connectDb() {
  const cache = getDbCache();
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = Promise.resolve({ dbPath: resolveDbPath() });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

function ensureDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(base, null, 2));
  }
}

function readDb() {
  const cache = getDbCache();
  const dbPath = cache.conn?.dbPath || resolveDbPath();
  ensureDb(dbPath);
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function writeDb(db) {
  const cache = getDbCache();
  const dbPath = cache.conn?.dbPath || resolveDbPath();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function withDb(mutator) {
  const db = readDb();
  const updated = mutator(db) || db;
  writeDb(updated);
  return updated;
}

function nextId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { connectDb, readDb, writeDb, withDb, nextId };
