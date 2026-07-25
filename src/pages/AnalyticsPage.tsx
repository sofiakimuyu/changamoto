import { useEffect, useState } from 'react'
import { BarChart3, Users, Activity, Gamepad2, Repeat } from 'lucide-react'
import { supabase, hasBackend } from '../lib/supabase'

// ── Shapes returned by the analytics_* views (supabase/analytics.sql) ─────────
interface Overview {
  total_users: number
  total_sessions: number
  total_events: number
  total_plays: number
  total_completions: number
  active_users_1d: number
  active_users_7d: number
  active_users_30d: number
}
interface DailyRow { day: string; active_users: number; sessions: number; plays: number; new_users: number }
interface GameRow { game: string; plays: number; completions: number; players: number; completion_rate: number | null }
interface RetentionRow { bucket: string; users: number }

// Friendly labels for game keys.
const GAME_LABELS: Record<string, string> = {
  'wordle-5': 'Neno la Leo (herufi 5)',
  'wordle-3': 'Neno la Herufi 3',
  'wordle-4': 'Neno la Herufi 4',
  'wordle-6': 'Neno la Herufi 6',
  'wordsearch': 'Tafuta Maneno',
  'pairmatch': 'Oanisha Maneno',
}
const gameLabel = (k: string) => GAME_LABELS[k] ?? k

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [games, setGames] = useState<GameRow[]>([])
  const [retention, setRetention] = useState<RetentionRow[]>([])
  const [loading, setLoading] = useState(hasBackend)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasBackend || !supabase) return
    let alive = true
    setLoading(true)
    Promise.all([
      supabase.from('analytics_overview').select('*').single(),
      supabase.from('analytics_daily').select('*').order('day', { ascending: true }),
      supabase.from('analytics_games').select('*').order('plays', { ascending: false }),
      supabase.from('analytics_retention').select('*'),
    ]).then(([o, d, g, r]) => {
      if (!alive) return
      const firstErr = o.error || d.error || g.error || r.error
      if (firstErr) setError(firstErr.message)
      setOverview((o.data as Overview) ?? null)
      setDaily((d.data as DailyRow[]) ?? [])
      setGames((g.data as GameRow[]) ?? [])
      setRetention((r.data as RetentionRow[]) ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-6 h-6 text-ochre-500" />
        <h1 className="text-3xl font-black text-umber-700">Takwimu</h1>
      </div>
      <p className="text-umber-400 text-sm mb-6">Watu wangapi wanacheza, na mara ngapi</p>

      {!hasBackend ? (
        <NoBackend />
      ) : loading ? (
        <div className="text-center text-umber-400 text-sm py-10">Inapakia takwimu…</div>
      ) : (
        <>
          {error && (
            <div className="bg-maasai-100 text-maasai-700 rounded-2xl px-4 py-3 text-sm mb-5">
              Baadhi ya takwimu hazikupatikana: {error}. Hakikisha umeendesha <code>supabase/analytics.sql</code>.
            </div>
          )}

          {/* Headline metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Metric icon={<Users className="w-4 h-4" />} label="Watumiaji" value={overview?.total_users ?? 0}
              hint="Vifaa vyote vilivyocheza" />
            <Metric icon={<Activity className="w-4 h-4" />} label="Vipindi" value={overview?.total_sessions ?? 0}
              hint="Ziara zote" />
            <Metric icon={<Gamepad2 className="w-4 h-4" />} label="Michezo" value={overview?.total_plays ?? 0}
              hint="Michezo iliyoanzishwa" />
            <Metric icon={<Repeat className="w-4 h-4" />} label="Tukio" value={overview?.total_events ?? 0}
              hint="Matukio yote" />
          </div>

          {/* Active users window */}
          <Card title="Watumiaji hai">
            <div className="grid grid-cols-3 gap-3 text-center">
              <ActiveStat label="Leo (24h)" value={overview?.active_users_1d ?? 0} />
              <ActiveStat label="Wiki (7d)" value={overview?.active_users_7d ?? 0} />
              <ActiveStat label="Mwezi (30d)" value={overview?.active_users_30d ?? 0} />
            </div>
          </Card>

          {/* Daily trend */}
          <Card title="Mwenendo wa kila siku">
            {daily.length === 0
              ? <Empty text="Bado hakuna matukio." />
              : <DailyChart rows={daily.slice(-30)} />}
          </Card>

          {/* Per-game popularity */}
          <Card title="Michezo maarufu">
            {games.length === 0
              ? <Empty text="Bado hakuna michezo iliyorekodiwa." />
              : <GameBars rows={games} />}
          </Card>

          {/* Engagement / stickiness */}
          <Card title="Wanaorudi">
            {retention.length === 0
              ? <Empty text="Bado hakuna data ya kutosha." />
              : <Retention rows={retention} />}
          </Card>
        </>
      )}
    </div>
  )
}

// ── Pieces ────────────────────────────────────────────────────────────────────
function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-umber-400 mb-1.5">{icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-umber-700 leading-none">{value.toLocaleString()}</p>
      <p className="text-umber-300 text-[11px] mt-1">{hint}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-card mb-5">
      <h2 className="font-black text-umber-700 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function ActiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-sand-100 rounded-2xl py-4">
      <p className="text-2xl font-black text-umber-700">{value.toLocaleString()}</p>
      <p className="text-umber-400 text-[11px] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-umber-400 text-sm text-center py-6">{text}</p>
}

// Simple CSS bar chart of active users per day (last 30 days).
function DailyChart({ rows }: { rows: DailyRow[] }) {
  const max = Math.max(1, ...rows.map(r => r.active_users))
  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {rows.map(r => (
          <div key={r.day} className="flex-1 flex flex-col justify-end group relative">
            <div className="w-full bg-ochre-400 rounded-t-md hover:bg-ochre-500 transition-colors"
              style={{ height: `${(r.active_users / max) * 100}%`, minHeight: r.active_users ? '3px' : '0' }} />
            <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap
              bg-umber-700 text-white text-[10px] rounded-md px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {r.day.slice(5)}: {r.active_users} watu · {r.plays} michezo
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-umber-300 text-[10px] mt-2">
        <span>{rows[0]?.day.slice(5)}</span>
        <span>Watumiaji hai kwa siku</span>
        <span>{rows[rows.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  )
}

function GameBars({ rows }: { rows: GameRow[] }) {
  const max = Math.max(1, ...rows.map(r => r.plays))
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.game}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-semibold text-umber-700">{gameLabel(r.game)}</span>
            <span className="text-umber-400 text-xs">
              {r.plays.toLocaleString()} michezo · {r.players} watu
              {r.completion_rate != null && ` · ${r.completion_rate}% wamemaliza`}
            </span>
          </div>
          <div className="h-2.5 bg-sand-100 rounded-full overflow-hidden">
            <div className="h-full bg-savanna-500 rounded-full" style={{ width: `${(r.plays / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Retention({ rows }: { rows: RetentionRow[] }) {
  const order = ['1 day', '2-3 days', '4-7 days', '8+ days']
  const sorted = [...rows].sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket))
  const total = Math.max(1, sorted.reduce((s, r) => s + r.users, 0))
  return (
    <div className="space-y-2.5">
      {sorted.map(r => {
        const pct = Math.round((r.users / total) * 100)
        return (
          <div key={r.bucket} className="flex items-center gap-3">
            <span className="w-16 text-umber-500 text-xs font-semibold">{r.bucket}</span>
            <div className="flex-1 h-4 bg-sand-100 rounded-full overflow-hidden">
              <div className="h-full bg-saffron-400 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-20 text-right text-umber-500 text-xs">{r.users} watu · {pct}%</span>
          </div>
        )
      })}
      <p className="text-umber-300 text-[11px] pt-1">Idadi ya siku tofauti kila kifaa kimecheza.</p>
    </div>
  )
}

function NoBackend() {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-card text-center">
      <p className="text-umber-600 mb-3">
        Takwimu zinahitaji seva ya Supabase. Weka <code>VITE_SUPABASE_URL</code> na
        {' '}<code>VITE_SUPABASE_ANON_KEY</code>, kisha endesha <code>supabase/analytics.sql</code>.
      </p>
      <p className="text-umber-400 text-sm">Bila seva, mchezo hukimbia lakini hakuna takwimu zinazokusanywa.</p>
    </div>
  )
}
