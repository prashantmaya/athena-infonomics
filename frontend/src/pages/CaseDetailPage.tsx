import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCaseDetail, getCaseTimeline } from '../lib/api'
import type { CaseRecord, TimelineEvent } from '../types'

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const parsedCaseId = Number(caseId)
  const [record, setRecord] = useState<CaseRecord | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!parsedCaseId || Number.isNaN(parsedCaseId)) {
      setError('Invalid case id.')
      return
    }

    const load = async () => {
      try {
        const [caseRecord, events] = await Promise.all([
          getCaseDetail(parsedCaseId),
          getCaseTimeline(parsedCaseId),
        ])
        setRecord(caseRecord)
        setTimeline(events)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load case detail.'
        setError(message)
      }
    }

    void load()
  }, [parsedCaseId])

  if (error) {
    return (
      <section className="page">
        <h2>Case detail</h2>
        <p className="banner banner-error">{error}</p>
        <Link to="/cases">Back to cases</Link>
      </section>
    )
  }

  return (
    <section className="page">
      <h2>Case detail</h2>
      {!record ? (
        <p>Loading case...</p>
      ) : (
        <>
          <div className="panel">
            <p><strong>ID:</strong> {record.id}</p>
            <p><strong>Title:</strong> {record.title}</p>
            <p><strong>Status:</strong> {record.status}</p>
            <p><strong>Priority:</strong> {record.priority}</p>
            <p><strong>Assigned Agent:</strong> {record.assignedAgentId ?? 'Unassigned'}</p>
            <p><strong>Version:</strong> {record.version}</p>
          </div>
          <div className="panel">
            <h3>Timeline</h3>
            <ul className="card-list">
              {timeline.map((event) => (
                <li key={event.id}>
                  <strong>{event.type}</strong>: {event.title} - {event.description}
                </li>
              ))}
              {timeline.length === 0 && <li>No timeline events yet.</li>}
            </ul>
          </div>
        </>
      )}
      <Link to="/cases">Back to cases</Link>
    </section>
  )
}
