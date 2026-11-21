import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDb() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('vehiclevault.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      make TEXT, model TEXT, year INTEGER,
      odometer REAL NOT NULL DEFAULT 0,
      odometer_updated_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      interval_miles REAL NOT NULL,
      interval_months INTEGER NOT NULL,
      last_miles REAL, last_date TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      item_id INTEGER,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      cost REAL,
      vendor TEXT,
      notes TEXT,
      photo_uris TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_vehicle ON items(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_logs_vehicle ON logs(vehicle_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
}

export async function getSetting(key, fallback = null) {
  const d = await getDb();
  const row = await d.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const d = await getDb();
  await d.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
}

/** 首次使用写入默认保养项（用户可改） */
export async function seedItems(vehicleId) {
  const d = await getDb();
  const presets = [
    ['Oil & filter', 5000, 6],
    ['Tire rotation', 6000, 6],
    ['Engine air filter', 15000, 12],
    ['Cabin air filter', 15000, 12],
    ['Brake fluid', 30000, 24],
    ['Coolant', 50000, 48],
    ['Spark plugs', 60000, 48],
  ];
  for (const [name, mi, mo] of presets) {
    await d.runAsync(
      'INSERT INTO items (vehicle_id, name, interval_miles, interval_months) VALUES (?,?,?,?)',
      [vehicleId, name, mi, mo]
    );
  }
}

export async function listVehicles() {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM vehicles ORDER BY id DESC');
}

export async function createVehicle(v) {
  const d = await getDb();
  const res = await d.runAsync(
    'INSERT INTO vehicles (nickname, make, model, year, odometer, odometer_updated_at, created_at) VALUES (?,?,?,?,?,?,?)',
    [v.nickname, v.make || null, v.model || null, v.year || null, v.odometer || 0, v.date || null, new Date().toISOString()]
  );
  await seedItems(res.lastInsertRowId);
  return res.lastInsertRowId;
}

export async function listItems(vehicleId) {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM items WHERE vehicle_id = ? ORDER BY id', [vehicleId]);
}

export async function listLogs(vehicleId) {
  const d = await getDb();
  return d.getAllAsync('SELECT * FROM logs WHERE vehicle_id = ? ORDER BY date DESC, id DESC', [vehicleId]);
}

export async function addLog(vehicleId, log) {
  const d = await getDb();
  await d.runAsync(
    'INSERT INTO logs (vehicle_id, item_id, type, date, odometer, cost, vendor, notes, photo_uris, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [vehicleId, log.itemId || null, log.type, log.date, log.odometer, log.cost ?? null, log.vendor || null, log.notes || null, JSON.stringify(log.photoUris || []), new Date().toISOString()]
  );
  if (log.itemId) {
    await d.runAsync('UPDATE items SET last_miles = ?, last_date = ? WHERE id = ?', [log.odometer, log.date, log.itemId]);
  }
  if (log.odometer >= 0) {
    await d.runAsync('UPDATE vehicles SET odometer = ?, odometer_updated_at = ? WHERE id = ?', [log.odometer, log.date, vehicleId]);
  }
}

export async function updateOdometer(vehicleId, miles, date) {
  const d = await getDb();
  await d.runAsync('UPDATE vehicles SET odometer = ?, odometer_updated_at = ? WHERE id = ?', [miles, date, vehicleId]);
}

export async function updateItem(itemId, patch) {
  const d = await getDb();
  await d.runAsync(
    'UPDATE items SET name = ?, interval_miles = ?, interval_months = ?, last_miles = ?, last_date = ? WHERE id = ?',
    [patch.name, patch.interval_miles, patch.interval_months, patch.last_miles ?? null, patch.last_date ?? null, itemId]
  );
}
