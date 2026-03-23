import type { SyncStatus } from '../types'

const labels: Record<SyncStatus, string> = {
  pending: 'Pending',
  syncing: 'Syncing',
  synced: 'Synced',
  failed: 'Failed (retry)',
}

export function StatusBadge({ status }: { status: SyncStatus }) {
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>
}
