const DB_NAME = 'hl-term'
const DB_VERSION = 3

export const READS_STORE = 'reads'
export const POSITIONS_STORE = 'positions'
export const LEDGER_STORE = 'ledger'

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(READS_STORE)) {
    const store = db.createObjectStore(READS_STORE, { keyPath: 'id', autoIncrement: true })
    store.createIndex('key', 'key', { unique: false })
  }
  if (!db.objectStoreNames.contains(POSITIONS_STORE)) {
    db.createObjectStore(POSITIONS_STORE, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(LEDGER_STORE)) {
    db.createObjectStore(LEDGER_STORE, { keyPath: 'id', autoIncrement: true })
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => upgrade(req.result)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txToPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

/**
 * Opens a fresh connection, runs `fn` against the named store inside one
 * read/write-typed transaction, waits for the transaction to commit, then
 * closes the connection. `fn` may issue any number of requests against
 * `store`; only its return value (if a request) is awaited for the result.
 */
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(storeName, mode)
    const result = reqToPromise(fn(tx.objectStore(storeName)))
    await txToPromise(tx)
    return await result
  } finally {
    db.close()
  }
}
