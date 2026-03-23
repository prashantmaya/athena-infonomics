import { pushAgentSync, pullAgentSync } from './api'
import {
  cacheCases,
  getCachedCases,
  getSyncCursor,
  listOutboxItems,
  removeOutboxItem,
  setSyncCursor,
  updateOutboxItemStatus,
} from './db'
import type { CaseRecord, OutboxItem } from '../types'

export async function performPullSync(
  agentId: number,
  programId = 1,
): Promise<CaseRecord[]> {
  const cursor = await getSyncCursor(agentId, programId)
  const response = await pullAgentSync(agentId, cursor, programId)
  await cacheCases(response.assignedCases)
  await setSyncCursor(agentId, programId, response.nextCursor)
  return response.assignedCases
}

export async function getAssignedCasesFromCache(
  agentId: number,
  programId?: number,
): Promise<CaseRecord[]> {
  const cached = await getCachedCases()
  return cached.filter(
    (caseRecord) =>
      caseRecord.assignedAgentId === agentId &&
      (programId === undefined || caseRecord.programId === programId),
  )
}

export async function performPushSync(agentId: number): Promise<{ success: number; failed: number }> {
  const all = await listOutboxItems()
  const queue = all.filter((item) => item.agentId === agentId && item.status !== 'synced')

  if (queue.length === 0) {
    return { success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  for (const item of queue) {
    await updateOutboxItemStatus(item.clientActivityId, 'syncing')
  }

  for (const item of queue) {
    try {
      await pushAgentSync(agentId, [item])
      await updateOutboxItemStatus(item.clientActivityId, 'synced')
      await removeOutboxItem(item.clientActivityId)
      success += 1
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      await updateOutboxItemStatus(item.clientActivityId, 'failed', errorMessage)
      failed += 1
    }
  }

  return { success, failed }
}

export async function performPushSyncForProgram(
  agentId: number,
  programId: number,
): Promise<{ success: number; failed: number }> {
  const all = await listOutboxItems()
  const queue = all.filter(
    (item) => item.agentId === agentId && item.programId === programId && item.status !== 'synced',
  )

  if (queue.length === 0) {
    return { success: 0, failed: 0 }
  }

  let success = 0
  let failed = 0

  for (const item of queue) {
    await updateOutboxItemStatus(item.clientActivityId, 'syncing')
  }

  for (const item of queue) {
    try {
      await pushAgentSync(agentId, [item])
      await updateOutboxItemStatus(item.clientActivityId, 'synced')
      await removeOutboxItem(item.clientActivityId)
      success += 1
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error'
      await updateOutboxItemStatus(item.clientActivityId, 'failed', errorMessage)
      failed += 1
    }
  }

  return { success, failed }
}

export function createOutboxItem(
  activity: Omit<OutboxItem, 'status' | 'retries' | 'createdAt'>,
): OutboxItem {
  return {
    ...activity,
    status: 'pending',
    retries: 0,
    createdAt: new Date().toISOString(),
  }
}
