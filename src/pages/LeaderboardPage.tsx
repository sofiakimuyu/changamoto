import { useState, useMemo } from 'react'
import { Trophy, Pencil, Check, Flame } from 'lucide-react'
import {
  getDaily, getAllTime, getPlayerName, setPlayerName, getPlayerStats, LeaderRow,
} from '../lib/leaderboard'
import { getDayIndex } from '../lib/wordle'

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
          {row.name}{row.isPlayer && ' (you)'}
        </p>
        <p className="text-umber-400 text-xs">{row.detail}</p>
      </div>
      <div className="font-black text-umber-700">{row.points}<span className="text-umber-300 text-xs font-semibold ml-1">pts</span></div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('today')
  const [name, setName] = useState(getPlayerName())
  const [editing, setEditing] = useState(getPlayerName() === '')
  const [tick, setTick] = useState(0) // bump to recompute after name save

  const day = getDayIndex()
  const daily = useMemo(() => getDaily(day), [day, tick])
  const allTime = useMemo(() => getAllTime(), [tick])
  const stats = useMemo(() => getPlayerStats(), [tick])

  const saveName = () => {
    setPlayerName(name)
    setEditing(false)
    setTick(t => t + 1)
  }

  const board = tab === 'today' ? daily : allTime

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-6 h-6 text-ochre-500"/>
        <h1 className="text-3xl font-black text-umber-700">Leaderboard</h1>
      </div>
      <p className="text-umber-400 text-sm mb-5">How you rank on the daily Neno la Leo</p>

      {/* Player name + stats */}
      <div className="bg-white rounded-3xl p-5 shadow-card mb-5">
        <div className="flex items-center justify-between mb-4">
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="Your name"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700"/>
              <button onClick={saveName} className="btn-primary !px-4 !py-2 flex items-center gap-1"><Check className="w-4 h-4"/> Save</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="font-black text-umber-700 text-lg">{getPlayerName() || 'You'}</p>
              <button onClick={() => setEditing(true)} className="text-umber-400"><Pencil className="w-4 h-4"/></button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Played" value={stats.played} />
          <Stat label="Win %" value={`${stats.winRate}`} />
          <Stat label="Points" value={stats.totalPoints} />
          <Stat label="Streak" value={stats.currentStreak} icon={<Flame className="w-3.5 h-3.5 text-maasai-500 inline"/>} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-sand-200 rounded-full p-1">
        {(['today', 'alltime'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all ${
              tab === t ? 'bg-white text-umber-700 shadow-soft' : 'text-umber-400'
            }`}>
            {t === 'today' ? 'Today' : 'All-time'}
          </button>
        ))}
      </div>

      {board.playerRank && (
        <div className="text-center mb-4 text-umber-500 text-sm">
          You’re <strong className="text-ochre-600">#{board.playerRank}</strong> {tab === 'today' ? 'today' : 'this season'}
        </div>
      )}
      {tab === 'today' && !daily.playerRank && (
        <div className="text-center mb-4 text-umber-400 text-sm bg-sand-200 rounded-2xl py-3 px-4">
          Play today’s Neno la Leo to join the board.
        </div>
      )}

      <RankList rows={board.rows} playerRank={board.playerRank} />

      <p className="text-umber-300 text-[11px] text-center mt-6 leading-relaxed">
        Your scores are real and saved on this device. The surrounding field is a simulated community
        so the board is lively before a shared server is connected.
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
