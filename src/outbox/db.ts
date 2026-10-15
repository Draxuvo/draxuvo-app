import * as SQLite from "expo-sqlite";

export type OutboxKind = "note" | "photo";
/** pending: espera red · sending: en vuelo · failed: la API lo rechazó, se puede reintentar · discardable: la orden ya no existe o no es de la persona. */
export type OutboxState = "pending" | "sending" | "failed" | "discardable";

export interface OutboxItem {
  /** UUID que viaja como `Idempotency-Key`: un reenvío nunca duplica. */
  id: string;
  companyId: number;
  userId: number;
  orderId: number;
  kind: OutboxKind;
  text: string | null;
  fileUri: string | null;
  fileName: string | null;
  fileType: string | null;
  description: string | null;
  state: OutboxState;
  error: string | null;
  attempts: number;
  createdAt: number;
}

export interface OutboxScope {
  companyId: number;
  userId: number;
  orderId?: number;
}

/** Almacén de la cola. La implementación real es SQLite; las pruebas usan una en memoria. */
export interface OutboxStore {
  insert(item: OutboxItem): Promise<void>;
  update(id: string, patch: Partial<Pick<OutboxItem, "state" | "error" | "attempts">>): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<OutboxItem | null>;
  list(scope: OutboxScope): Promise<OutboxItem[]>;
  /** Tras cerrar la app a mitad de un envío: lo que quedó "sending" vuelve a "pending". */
  resetSending(scope: OutboxScope): Promise<void>;
}

interface Row {
  id: string;
  company_id: number;
  user_id: number;
  order_id: number;
  kind: OutboxKind;
  text: string | null;
  file_uri: string | null;
  file_name: string | null;
  file_type: string | null;
  description: string | null;
  state: OutboxState;
  error: string | null;
  attempts: number;
  created_at: number;
}

const toItem = (row: Row): OutboxItem => ({
  id: row.id,
  companyId: row.company_id,
  userId: row.user_id,
  orderId: row.order_id,
  kind: row.kind,
  text: row.text,
  fileUri: row.file_uri,
  fileName: row.file_name,
  fileType: row.file_type,
  description: row.description,
  state: row.state,
  error: row.error,
  attempts: row.attempts,
  createdAt: row.created_at,
});

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function database(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("outbox.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        company_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        text TEXT,
        file_uri TEXT,
        file_name TEXT,
        file_type TEXT,
        description TEXT,
        state TEXT NOT NULL,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_scope ON outbox (company_id, user_id, order_id);
    `);
    return db;
  })();
  return dbPromise;
}

export const sqliteStore: OutboxStore = {
  async insert(item) {
    const db = await database();
    await db.runAsync(
      `INSERT INTO outbox (id, company_id, user_id, order_id, kind, text, file_uri, file_name, file_type, description, state, error, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.companyId, item.userId, item.orderId, item.kind, item.text, item.fileUri, item.fileName, item.fileType, item.description, item.state, item.error, item.attempts, item.createdAt],
    );
  },
  async update(id, patch) {
    const db = await database();
    const current = await sqliteStore.get(id);
    if (!current) return;
    const next = { ...current, ...patch };
    await db.runAsync("UPDATE outbox SET state = ?, error = ?, attempts = ? WHERE id = ?", [next.state, next.error, next.attempts, id]);
  },
  async remove(id) {
    const db = await database();
    await db.runAsync("DELETE FROM outbox WHERE id = ?", [id]);
  },
  async get(id) {
    const db = await database();
    const row = await db.getFirstAsync<Row>("SELECT * FROM outbox WHERE id = ?", [id]);
    return row ? toItem(row) : null;
  },
  async list({ companyId, userId, orderId }) {
    const db = await database();
    const rows =
      orderId == null
        ? await db.getAllAsync<Row>("SELECT * FROM outbox WHERE company_id = ? AND user_id = ? ORDER BY created_at, rowid", [companyId, userId])
        : await db.getAllAsync<Row>("SELECT * FROM outbox WHERE company_id = ? AND user_id = ? AND order_id = ? ORDER BY created_at, rowid", [companyId, userId, orderId]);
    return rows.map(toItem);
  },
  async resetSending({ companyId, userId }) {
    const db = await database();
    await db.runAsync("UPDATE outbox SET state = 'pending' WHERE company_id = ? AND user_id = ? AND state = 'sending'", [companyId, userId]);
  },
};
