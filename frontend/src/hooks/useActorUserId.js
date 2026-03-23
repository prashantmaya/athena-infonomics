import { useMemo, useState } from 'react'

const defaults = {
  coordinator: 1,
  agent: 1,
  supervisor: 1,
}

export function useActorUserId(role) {
  const [map, setMap] = useState(defaults)
  const userId = useMemo(() => map[role] ?? 1, [map, role])

  const setActorUserId = (nextId) => {
    setMap((current) => ({ ...current, [role]: Number(nextId) || 1 }))
  }

  return { userId, setActorUserId }
}
