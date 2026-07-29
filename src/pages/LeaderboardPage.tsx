import { useState, useMemo, useEffect } from 'react'
import { Trophy, Pencil, Check, Flame } from 'lucide-react'
import {
  getDailyBoard, getAllTimeBoard, submitDaily, syncPendingResults,
  getPlayerName, setPlayerName, getPlayerStats, Board, LeaderRow,
} from '../lib/leaderboard'
import { hasBackend } from '../lib/supabase'
import { getDayIndex } from '../lib/wordle'

const EMPTY_BOARD: Board = { rows: [], playerRank: null, source: 'shared', error: null }

type Tab = 'today' | 'alltime'

function RankList({ rows, playerRank }: { rows: LeaderRow[]; playerRank: number | null }) {
  // Show the top 10, and always the player's own row even if further down.
  const top = rows.slice(0, 10)
  const playerInTop = playerRank !== null && playerRank <= 10
  const playerRow = playerRank !== null && !playerInTop ? rows[playerRank - 1] : null

  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`)

  return (
    <div className="space-y-1.5">
      {top.map((r, i) => (
        <Row key={i} rank={i + 1} label={medal(i)} row={r} />
      ))}
      {playerRow && (
        <>
          <p className="text-center text-umber-300 text-xs py-1">···</p>
          <Row rank={playerRank!} label={`${playerRank}`} row={playerRow} />
        </>
      )}
    </div>
  )
}

function Row({ rank, label, row }: { rank: number; label: string; row: LeaderRow }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
      row.isPlayer ? 'bg-ochre-100 border-2 border-ochre-300' : 'bg-white shadow-soft'
    }`}>
      <div className={`w-8 text-center font-black ${rank <= 3 ? 'text-lg' : 'text-umber-400 text-sm'}`}>{label}</div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate ${row.isPlayer ? 'text-ochre-700' : 'text-umber-700'}`}>
          {row.name}{row.isPlayer && ' (wewe)'}
        </p>
        <p className="text-umber-400 text-xs">{row.detail}</p>
      </div>
      <div className="font-black text-umber-700">{row.points}<span className="text-umber-300 text-xs font-semibold ml-1">pt</span></div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('today')
  const [name, setName] = useState(getPlayerName())
  const [editing, setEditing] = useState(getPlayerName() === '')
  const [tick, setTick] = useState(0) // bump to recompute after name save

  const day = getDayIndex()
  const [daily, setDaily] = useState<Board>(EMPTY_BOARD)
  const [allTime, setAllTime] = useState<Board>(EMPTY_BOARD)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)
  const stats = useMemo(() => getPlayerStats(), [tick])

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Push up any finished day that never reached the shared board before
    // reading it back, so a submit that failed earlier heals on this visit.
    syncPendingResults()
      .then(outcome => { if (alive) setSyncError(outcome.error) })
      .then(() => Promise.all([getDailyBoard(day), getAllTimeBoard()]))
      .then(([d, a]) => {
        if (!alive) return
        setDaily(d); setAllTime(a)
      })
      .catch(e => {
        // Never leave the page stuck on the loading state.
        console.warn('leaderboard load failed:', e)
        if (alive) setSyncError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [day, tick])

  const saveName = () => {
    setPlayerName(name)
    setEditing(false)
    // Publish today under the new name if it hasn't gone up yet (rows are
    // append-only, so an already-published day keeps the name it was sent with),
    // then refresh the boards.
    submitDaily(day).finally(() => setTick(t => t + 1))
  }

  const board = tab === 'today' ? daily : allTime

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-6 h-6 text-ochre-500"/>
        <h1 className="text-3xl font-black text-umber-700">Viongozi</h1>
      </div>
      <p className="text-umber-400 text-sm mb-5">Nafasi yako kwenye Neno la Leo</p>

      {/* Player name + stats */}
      <div className="bg-white rounded-3xl p-5 shadow-card mb-5">
        <div className="flex items-center justify-between mb-4">
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="Jina lako"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700"/>
              <button onClick={saveName} className="btn-primary !px-4 !py-2 flex items-center gap-1"><Check className="w-4 h-4"/> Hifadhi</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-black text-umber-700 text-lg">{getPlayerName() || 'Wewe'}</p>
              <button onClick={() => setEditing(true)} className="text-umber-400"><Pencil className="w-4 h-4"/></button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Michezo" value={stats.played} />
          <Stat label="Ushindi %" value={`${stats.winRate}`} />
          <Stat label="Pointi" value={stats.totalPoints} />
          <Stat label="Mfululizo" value={stats.currentStreak} icon={<Flame className="w-3.5 h-3.5 text-maasai-500 inline"/>} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-sand-200 rounded-full p-1">
        {(['today', 'alltime'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all ${
              tab === t ? 'bg-white text-umber-700 shadow-soft' : 'text-umber-400'
            }`}>
            {t === 'today' ? 'Leo' : 'Wakati wote'}
          </button>
        ))}
      </div>

      {board.playerRank && (
        <div className="text-center mb-4 text-umber-500 text-sm">
          Uko nafasi ya <strong className="text-ochre-600">#{board.playerRank}</strong> {tab === 'today' ? 'leo' : 'msimu huu'}
        </div>
      )}
      {tab === 'today' && !daily.playerRank && (
        <div className="text-center mb-4 text-umber-400 text-sm bg-sand-200 rounded-2xl py-3 px-4">
          Cheza Neno la Leo ili ujiunge na ubao.
        </div>
      )}

      {/* A score that couldn't be published would otherwise fail silently, and
          the player would just never appear on the board. */}
      {syncError && (
        <div className="mb-4 text-center text-sm bg-red-100 border border-red-300 text-red-700 rounded-2xl py-3 px-4">
          Alama yako haikuweza kutumwa kwenye ubao wa pamoja. Tutajaribu tena utakapofungua ukurasa huu.
        </div>
      )}

      {loading ? (
        <div className="text-center text-umber-400 text-sm py-10">Inapakia viongozi…</div>
      ) : board.rows.length === 0 ? (
        <div className="text-center text-umber-400 text-sm bg-white rounded-2xl py-8 px-4 shadow-soft">
          {board.error
            ? 'Imeshindikana kupakia ubao wa viongozi. Angalia mtandao kisha jaribu tena.'
            : 'Bado hakuna alama — kuwa wa kwanza kwenye ubao!'}
        </div>
      ) : (
        <RankList rows={board.rows} playerRank={board.playerRank} />
      )}

      <p className="text-umber-300 text-[11px] text-center mt-6 leading-relaxed">
        {hasBackend && board.source === 'shared'
          ? 'Alama zinashirikiwa moja kwa moja kwa wachezaji wote. Utaonekana ukimaliza Neno la Leo la leo.'
          : 'Alama zako ni halisi na zimehifadhiwa kwenye kifaa hiki. Washindani wanaokuzunguka ni jamii ya kuigiza inayoonyeshwa hadi seva ya pamoja iunganishwe.'}
      </p>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-sand-100 rounded-2xl py-3">
      <p className="text-xl font-black text-umber-700">{icon}{value}</p>
      <p className="text-umber-400 text-[11px] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  )
}
