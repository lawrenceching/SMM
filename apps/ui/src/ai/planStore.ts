import type { RecognizeMediaFilePlan } from '@core/types/RecognizeMediaFilePlan';
import type { RenameFilesPlan } from '@core/types/RenameFilesPlan';
import { Path } from '@core/path';
import { createEmptyRenamePlan } from '@core/plan/renamePlan';

/**
 * IndexedDB-backed plan store for frontend AI tools.
 *
 * Replaces the backend's filesystem-based plan storage (Bun.file in
 * `{userDataDir}/plans/`) for tools that run in the browser via
 * `ReverseProxyChatTransport`. The backend storage is unchanged — this
 * store is a parallel implementation for the frontend path.
 *
 * Design notes:
 *
 * - Plans are stored in a single IndexedDB object store named
 *   `plans`, keyed by the plan's `id` (UUID). Both
 *   `RecognizeMediaFilePlan` and `RenameFilesPlan` share the store —
 *   they are discriminated by their `task` field.
 *
 * - The store is opened lazily on first call. We do not block module
 *   import on `indexedDB.open()`; instead, the first `await` on any
 *   exported function waits for the open to resolve.
 *
 * - All operations are async and return Promises — they cannot throw
 *   synchronously. Errors propagate to the caller.
 *
 * - The `mediaFolderPath` is normalized to POSIX on write so that
 *   cross-platform paths stored by the tool match what the UI
 *   expects (the UI uses POSIX paths everywhere).
 */

const DB_NAME = 'smm-ai-plans'
const DB_VERSION = 1
const STORE_NAME = 'plans'

type AnyPlan = RecognizeMediaFilePlan | RenameFilesPlan

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use `id` as the keyPath so we can use `get(id)` / `put(plan)`
        // directly without a separate out-of-line key.
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
    req.onblocked = () =>
      reject(new Error('IndexedDB open blocked by another connection'))
  })
  return dbPromise
}

/**
 * Run a transaction on the plans store.
 *
 * The callback may return an `IDBRequest` to capture its `.result`; if
 * it returns nothing, the transaction just commits when the callback
 * returns. Commit is implicit on callback return — we resolve with
 * either the captured `IDBRequest.result` (if any) or `undefined`.
 */
function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const store = tx.objectStore(STORE_NAME)
        let captured: T | undefined
        const req = fn(store)
        if (req) {
          req.onsuccess = () => {
            captured = req.result as T
          }
          req.onerror = () =>
            reject(req.error ?? new Error('IDBRequest failed'))
        }
        tx.oncomplete = () => resolve(captured)
        tx.onerror = () =>
          reject(tx.error ?? new Error('IDB transaction failed'))
        tx.onabort = () =>
          reject(tx.error ?? new Error('IDB transaction aborted'))
      }),
  )
}

function normalizeFolderPath(path: string): string {
  return Path.posix(path)
}

/**
 * Create a new recognize-media-file plan in IndexedDB.
 *
 * @param mediaFolderPath Absolute path of the media folder (POSIX or Windows format)
 * @returns The newly created plan (with generated `id`)
 */
export async function createRecognizePlan(
  mediaFolderPath: string,
): Promise<RecognizeMediaFilePlan> {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const plan: RecognizeMediaFilePlan = {
    id,
    task: 'recognize-media-file',
    status: 'pending',
    mediaFolderPath: normalizeFolderPath(mediaFolderPath),
    files: [],
  }

  await runTransaction('readwrite', (store) => store.put(plan))
  return plan
}

/**
 * Create a new rename-files plan in IndexedDB.
 */
export async function createRenamePlan(
  mediaFolderPath: string,
): Promise<RenameFilesPlan> {
  const plan = createEmptyRenamePlan(mediaFolderPath)
  await runTransaction('readwrite', (store) => store.put(plan))
  return plan
}

/**
 * Persist a full plan document to IndexedDB (insert or replace by id).
 */
export async function savePlan(plan: AnyPlan): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(plan))
}

/**
 * Read a plan by its `id`.
 *
 * @returns The plan, or `null` if not found.
 */
export async function readPlan(id: string): Promise<AnyPlan | null> {
  const result = await runTransaction<AnyPlan | undefined>(
    'readonly',
    (store) => store.get(id) as IDBRequest<AnyPlan | undefined>,
  )
  return result ?? null
}

/**
 * Add a recognized file to a recognize-media-file plan.
 *
 * @returns The updated plan, or `null` if the plan was not found.
 */
export async function addRecognizedFileToPlan(
  id: string,
  file: { season: number; episode: number; path: string },
): Promise<RecognizeMediaFilePlan | null> {
  const plan = await readPlan(id)
  if (!plan) return null
  if (plan.task !== 'recognize-media-file') {
    throw new Error(
      `Plan ${id} is not a recognize-media-file plan (task=${plan.task})`,
    )
  }

  const updated: RecognizeMediaFilePlan = {
    ...plan,
    files: [
      ...plan.files,
      {
        season: file.season,
        episode: file.episode,
        path: normalizeFolderPath(file.path),
      },
    ],
  }

  await runTransaction('readwrite', (store) => store.put(updated))
  return updated
}

/**
 * Add a rename entry to a rename-files plan (no validation — tests / internal use).
 */
export async function addRenameEntryToPlan(
  id: string,
  entry: { from: string; to: string },
): Promise<RenameFilesPlan | null> {
  const plan = await readPlan(id)
  if (!plan) return null
  if (plan.task !== 'rename-files') {
    throw new Error(
      `Plan ${id} is not a rename-files plan (task=${plan.task})`,
    )
  }

  const updated: RenameFilesPlan = {
    ...plan,
    files: [
      ...plan.files,
      {
        from: normalizeFolderPath(entry.from),
        to: normalizeFolderPath(entry.to),
      },
    ],
  }

  await runTransaction('readwrite', (store) => store.put(updated))
  return updated
}

/**
 * Update a plan's status.
 *
 * @returns The updated plan, or `null` if not found.
 */
export async function updatePlanStatus(
  id: string,
  status: 'pending' | 'completed' | 'rejected',
): Promise<AnyPlan | null> {
  const plan = await readPlan(id)
  if (!plan) return null

  const updated: AnyPlan = { ...plan, status }
  await runTransaction('readwrite', (store) => store.put(updated))
  return updated
}

/**
 * Delete a plan by its `id`. No-op if the plan does not exist.
 */
export async function deletePlan(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id))
}

/**
 * List all plans currently in the store.
 *
 * Intended for debugging / test cleanup. The UI does not need this
 * function — it reads plans from the Zustand `plansStore`, which the
 * tools populate when ending a task.
 */
export async function listAllPlans(): Promise<AnyPlan[]> {
  const result = await runTransaction<AnyPlan[]>(
    'readonly',
    (store) => store.getAll() as IDBRequest<AnyPlan[]>,
  )
  return result ?? []
}

export async function cleanupStalePlans(): Promise<void> {
  const all = await listAllPlans()
  await Promise.all(
    all
      .filter((plan) => plan.status !== 'pending')
      .map((plan) => deletePlan(plan.id)),
  )
}
