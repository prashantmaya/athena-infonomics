import { NavLink } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Athena Case Management Prototype</h1>
          <p>Offline-first workflow demo for coordinator, agent, and supervisor roles.</p>
        </div>
      </header>

      <nav className="app-nav">
        <NavLink to="/cases" className="nav-link">
          cases
        </NavLink>
        <NavLink to="/agent" className="nav-link">
          agent
        </NavLink>
        <NavLink to="/supervisor" className="nav-link">
          supervisor
        </NavLink>
      </nav>

      <main>{children}</main>
    </div>
  )
}
