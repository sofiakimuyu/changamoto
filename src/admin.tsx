// Standalone entry for the INTERNAL analytics dashboard. This is deliberately
// separate from the player-facing app (src/main.tsx / App.tsx): it has its own
// HTML file (admin.html) and its own bundle, renders no site navigation, and is
// not linked or routed to from the game. Reach it directly at
// `<site>/admin.html`; access is still gated to admins (see AnalyticsPage +
// supabase/analytics.sql).
import React from 'react'
import ReactDOM from 'react-dom/client'
import AnalyticsPage from './pages/AnalyticsPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-sand-100">
      <AnalyticsPage />
    </div>
  </React.StrictMode>,
)
