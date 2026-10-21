/**
 * Local save storage in IndexedDB, one slot (D-16, D-75). The save is stored as
 * the same readable JSON text that export produces.
 */

const DB_NAME = 'space-game'
const STORE = 'saves'
const SLOT = 'slot1'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function readSave(): Promise<string | null> {
  const text = await run('readonly', (store) => store.get(SLOT))
  return typeof text === 'string' ? text : null
}

export async function writeSave(text: string): Promise<void> {
  await run('readwrite', (store) => store.put(text, SLOT))
}

export async function deleteSave(): Promise<void> {
  await run('readwrite', (store) => store.delete(SLOT))
}

/**
 * Asks the browser not to clear our storage when space runs low (D-93).
 * Returns null where the browser has no such API.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}
