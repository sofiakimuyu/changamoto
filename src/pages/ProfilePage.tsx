import { useEffect, useState } from 'react'
import { User, Pencil, Check, Flame, Trophy, LogOut, Mail } from 'lucide-react'
import {
  getProfileStats, getAllTimeBoard, syncPendingResults,
  getPlayerName, setPlayerName, getFullName, GameId, ProfileStats,
} from '../lib/leaderboard'
import { useAuth, signOut } from '../lib/auth'
import { hasBackend } from '../lib/supabase'
import { MAX_ROWS } from '../lib/wordle'
import { navigate } from '../lib/router'
import SignUpModal from '../components/SignUpModal'

const EMPTY: ProfileStats = {
  played: 0, wins: 0, winRate: 0, totalPoints: 0, currentStreak: 0, bestStreak: 0,
  daysPlayed: 0, byGame: [], guessDistribution: Array.from({ length: MAX_ROWS }, () => 0),
  source: 'shared', error: null,
}

// Matches the cards on Michezo Zaidi so a game reads the same wherever it appears.
const GAME_META: Record<GameId, { emoji: string; title: string }> = {
  'wordle-3': { emoji: '🔤', title: 'Neno la Herufi 3' },
  'wordle-4': { emoji: '🔡', title: 'Neno la Herufi 4' },
  'wordle-5': { emoji: '🟩', title: 'Neno la Leo' },
  'wordle-6': { emoji: '🔠', title: 'Neno la Herufi 6' },
  'wordsearch': { emoji: '🔍', title: 'Tafuta Maneno' },
  'pairmatch': { emoji: '🧩', title: 'Oanisha Maneno' },
}

export default function ProfilePage() {
  const { member, loading: authLoading } = useAuth()
  const [name, setName] = useState(getPlayerName())
  const [editing, setEditing] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [tick, setTick] = useState(0)

  const [stats, setStats] = useState<ProfileStats>(EMPTY)
  const [rank, setRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // Publish anything still pending before reading the history back, so a
    // result that failed to submit earlier is counted on this visit.
    syncPendingResults()
      .then(() => Promise.all([getProfileStats(), getAllTimeBoard()]))
      .then(([s, board]) => {
        if (!alive) return
        setStats(s)
        setRank(board.playerRank)
      })
      .catch(e => { console.warn('profile load failed:', e) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tick, member?.id])

  const saveName = () => {
    setPlayerName(name)
    setEditing(false)
    // Rows are append-only, so only games not yet on the board pick up the new
    // name; refresh once they have.
    syncPendingResults().finally(() => setTick(t => t + 1))
  }

  const displayName = getPlayerName() || 'Mchezaji'
  const fullName = getFullName()
  const initial = displayName.trim().charAt(0).toUpperCase() || '?'
  const bestGuess = stats.guessDistribution.reduce((max, n) => Math.max(max, n), 0)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-6 h-6 text-ochre-500" />
        <h1 className="text-3xl font-black text-umber-700">Wasifu wangu</h1>
      </div>
      <p className="text-umber-400 text-sm mb-5">Takwimu zako kwenye michezo yote</p>

      {/* Identity card */}
      <div className="bg-white rounded-3xl p-5 shadow-card mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-ochre-100 text-ochre-700 flex items-center justify-center text-2xl font-black shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="Jina la mtumiaji"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />
                <button onClick={saveName} className="btn-primary !px-4 !py-2 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Hifadhi
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-black text-umber-700 text-lg truncate">{displayName}</p>
                  <button onClick={() => { setName(getPlayerName()); setEditing(true) }}
                    className="text-umber-400 shrink-0" aria-label="Badilisha jina la mtumiaji">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                {/* The real name, when the player gave one at sign-up. Only ever
                    shown to them — the board prints the username above. */}
                {fullName && <p className="text-umber-500 text-sm truncate">{fullName}</p>}
                <p className="text-umber-400 text-sm truncate">
                  {member ? (member.email || 'Umeingia') : 'Unacheza kwenye kifaa hiki pekee'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* A rank means nothing until something has been played — and the
            fallback board seats the player even with no games. */}
        {rank !== null && stats.played > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-sand-100 rounded-2xl px-4 py-3">
            <Trophy className="w-4 h-4 text-ochre-500 shrink-0" />
            <p className="text-umber-500 text-sm">
              Uko nafasi ya <strong className="text-ochre-600">#{rank}</strong> msimu huu
            </p>
            <button onClick={() => navigate('/leaderboard')}
              className="ml-auto text-ochre-600 text-sm font-bold shrink-0">Ubao →</button>
          </div>
        )}

        {member ? (
          <button onClick={() => signOut()}
            className="w-full mt-4 bg-white border-2 border-sand-200 text-umber-600 font-semibold py-2.5 rounded-full flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Toka
          </button>
        ) : !authLoading && (
          // Signed out: the stats below are only what this device has. Signing in
          // is what makes them follow the player everywhere.
          <div className="mt-4 bg-sand-100 rounded-2xl p-4">
            <p className="text-umber-500 text-sm mb-3">
              Fungua akaunti ili takwimu zako zihifadhiwe na zikufuate kwenye vifaa vyote.
            </p>
            <button onClick={() => setShowLogin(true)}
              className="w-full btn-primary flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" /> Ingia au jisajili
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-umber-400 text-sm py-10">Inapakia takwimu…</div>
      ) : stats.played === 0 ? (
        <div className="bg-white rounded-3xl py-8 px-4 shadow-soft text-center">
          <p className="text-umber-500 text-sm mb-4">Bado hujamaliza mchezo wowote.</p>
          <button onClick={() => navigate('/')} className="btn-primary">Cheza Neno la Leo</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Michezo" value={stats.played} />
            <Stat label="Ushindi" value={stats.wins} />
            <Stat label="Ushindi %" value={stats.winRate} />
            <Stat label="Pointi" value={stats.totalPoints} />
            <Stat label="Mfululizo" value={stats.currentStreak}
              icon={<Flame className="w-3.5 h-3.5 text-maasai-500 inline" />} />
            <Stat label="Rekodi" value={stats.bestStreak} />
          </div>

          {/* Per-game breakdown */}
          <div className="bg-white rounded-3xl p-5 shadow-card mb-4">
            <h2 className="font-black text-umber-700 mb-3">Kwa mchezo</h2>
            <div className="space-y-2">
              {stats.byGame.map(g => (
                <div key={g.game} className="flex items-center gap-3 bg-sand-100 rounded-2xl px-4 py-3">
                  <span className="text-xl shrink-0">{GAME_META[g.game].emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-umber-700 truncate">{GAME_META[g.game].title}</p>
                    <p className="text-umber-400 text-xs">michezo {g.played} · ushindi {g.wins}</p>
                  </div>
                  <div className="font-black text-umber-700 shrink-0">
                    {g.points}<span className="text-umber-300 text-xs font-semibold ml-1">pt</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wordle guess distribution */}
          {bestGuess > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-card mb-4">
              <h2 className="font-black text-umber-700 mb-1">Ulivyotatua Neno</h2>
              <p className="text-umber-400 text-xs mb-3">Idadi ya majaribu kwenye maneno uliyotatua</p>
              <div className="space-y-1.5">
                {stats.guessDistribution.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-umber-400 text-sm font-bold shrink-0">{i + 1}</span>
                    <div className="flex-1 bg-sand-100 rounded-full h-6 overflow-hidden flex items-center">
                      {n > 0 ? (
                        // Never narrower than the count it has to fit.
                        <div className="h-full bg-savanna-500 rounded-full flex items-center justify-end px-2 min-w-[1.75rem]"
                          style={{ width: `${(n / bestGuess) * 100}%` }}>
                          <span className="text-white text-xs font-bold">{n}</span>
                        </div>
                      ) : (
                        <span className="text-umber-300 text-xs font-bold px-2">0</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-umber-300 text-[11px] text-center leading-relaxed">
            {stats.error
              ? 'Imeshindikana kusoma historia ya pamoja — hizi ni takwimu za kifaa hiki.'
              : hasBackend && stats.source === 'shared'
                ? 'Takwimu hizi zinatoka kwenye akaunti yako na zinajumuisha vifaa vyote.'
                : 'Takwimu hizi zimehifadhiwa kwenye kifaa hiki.'}
          </p>
        </>
      )}

      {showLogin && <SignUpModal onClose={() => { setShowLogin(false); setTick(t => t + 1) }} />}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl py-3 text-center shadow-soft">
      <p className="text-xl font-black text-umber-700">{icon}{value}</p>
      <p className="text-umber-400 text-[11px] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  )
}
