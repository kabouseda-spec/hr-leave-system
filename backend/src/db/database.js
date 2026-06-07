require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './hr_leave.db';
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// node:sqlite returns null-prototype objects — convert them to plain objects
// so JSON.stringify and property checks work as expected.
function plain(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object') return Object.assign({}, v);
  return v;
}

const origPrepare = db.prepare.bind(db);

db.prepare = function (sql) {
  const stmt = origPrepare(sql);
  return {
    run: (...args) => stmt.run(...args),
    get: (...args) => plain(stmt.get(...args)),
    all: (...args) => plain(stmt.all(...args)),
  };
};

module.exports = db;
