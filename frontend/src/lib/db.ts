import { openDB } from 'idb'
import type { CaseRecord, OutboxItem, SyncStatus } from '../types'

const DB_NAME = 'athena-case-mgmt'
const DB_VERSION = 1
const CASE_STORE = 'cases'
const OUTBOX_STORE = 'outbox'
const META_STORE = 'meta'

type MetaRecord = { key: string; value: string }

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(CASE_STORE)) {
      db.createObjectStore(CASE_STORE, { keyPath: 'id' })
    }
    if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
      db.createObjectStore(OUTBOX_STORE, { keyPath: 'clientActivityId' })
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'key' })
    }
  },
})

export async function cacheCases(cases: CaseRecord[]): Promise<void> {
  const db = await dbPromise
  const tx = db.transaction(CASE_STORE, 'readwrite')
  await Promise.all(cases.map((record) => tx.store.put(record)))
  await tx.done
}

export async function getCachedCases(): Promise<CaseRecord[]> {
  const db = await dbPromise
  return db.getAll(CASE_STORE)
}

export async function addOutboxItem(item: OutboxItem): Promise<void> {
  const db = await dbPromise
  await db.put(OUTBOX_STORE, item)
}

export async function listOutboxItems(): Promise<OutboxItem[]> {
  const db = await dbPromise
  const items = await db.getAll(OUTBOX_STORE)
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateOutboxItemStatus(
  clientActivityId: string,
  status: SyncStatus,
  lastError?: string,
): Promise<void> {
  const db = await dbPromise
  const item = await db.get(OUTBOX_STORE, clientActivityId)
  if (!item) {
    return
  }
  const retries = status === 'failed' ? item.retries + 1 : item.retries
  await db.put(OUTBOX_STORE, {
    ...item,
    status,
    retries,
    lastError,
  })
}

export async function removeOutboxItem(clientActivityId: string): Promise<void> {
  const db = await dbPromise
  await db.delete(OUTBOX_STORE, clientActivityId)
}

function syncCursorKey(agentId: number, programId: number): string {
  return `sync_cursor:${programId}:${agentId}`
}

export async function getSyncCursor(agentId: number, programId: number): Promise<string | null> {
  const db = await dbPromise
  const row = await db.get(META_STORE, syncCursorKey(agentId, programId))
  return row?.value ?? null
}

export async function setSyncCursor(
  agentId: number,
  programId: number,
  cursor: string | null,
): Promise<void> {
  const db = await dbPromise
  const key = syncCursorKey(agentId, programId)
  if (!cursor) {
    await db.delete(META_STORE, key)
    return
  }
  const row: MetaRecord = {
    key,
    value: cursor,
  }
  await db.put(META_STORE, row)
}
