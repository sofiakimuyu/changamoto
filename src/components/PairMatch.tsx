import { useEffect, useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { VOCAB_CATEGORIES } from '../data/vocab-categories'
import { seededShuffle } from '../lib/wordsearch'
import { getDayIndex } from '../lib/wordle'
import { recordCompletion, submitDaily, MATCH_GAME, MATCH_POINTS } from '../lib/leaderboard'
import WinSheet from './WinSheet'

const ALL_WORDS = VOCAB_CATEGORIES.flatMap(c => c.words)

export default function PairMatch() {
  const dayIdx = getDayIndex()

  const puzzlePairs = useMemo(() =>
    seededShuffle(ALL_WORDS, dayIdx).slice(0, 5).map(w => ({
      swahili: w.swahili, english: w.english.split(' / ')[0].split(' (')[0],
    }))
  , [dayIdx])
  const englishShuffled = useMemo(() => seededShuffle(puzzlePairs.map(p => p.english), dayIdx + 1), [puzzlePairs, dayIdx])

  const [selectedSw, setSelectedSw] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [matchedEnglish, setMatchedEnglish] = useState<string[]>([])
  const [wrongFlash, setWrongFlash] = useState<string | null>(null)
  const [showWin, setShowWin] = useState(true)
  const puzzleDone = puzzlePairs.length > 0 && matched.length === puzzlePairs.length

  // Award daily points once for matching every pair.
  const scored = useRef(false)
  useEffect(() => {
    if (puzzleDone && !scored.current) {
      scored.current = true
      recordCompletion(dayIdx, MATCH_GAME, MATCH_POINTS)
      submitDaily(dayIdx)
    }
  }, [puzzleDone, dayIdx])

  const tapSwahili = (sw: string) => { if (!matched.includes(sw)) setSelectedSw(sw) }
  const tapEnglish = (en: string) => {
    if (!selectedSw || matchedEnglish.includes(en)) return
    const pair = puzzlePairs.find(p => p.swahili === selectedSw)
    if (pair?.english === en) {
      setMatched(m => [...m, selectedSw!]); setMatchedEnglish(m => [...m, en]); setSelectedSw(null)
    } else {
      setWrongFlash(selectedSw); setTimeout(() => { setWrongFlash(null); setSelectedSw(null) }, 700)
    }
  }

  return (
    <div className="px-4 pb-10 max-w-lg mx-auto">
      <h2 className="text-2xl font-black text-umber-700 mb-1">Oanisha Maneno</h2>
      <p className="text-umber-400 text-sm mb-6">Unganisha kila neno la Kiswahili na maana yake ya Kiingereza</p>

      {puzzleDone ? (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">✦</div>
          <h3 className="text-2xl font-black text-umber-700 mb-2">Umefanikiwa!</h3>
          <p className="text-umber-400 mb-6">Umeoanisha jozi zote {puzzlePairs.length}!</p>
          {showWin && (
            <WinSheet emoji="✦" title="Umeshinda!"
              subtitle={`Umeoanisha jozi zote ${puzzlePairs.length}!`}
              shareText={`Changamoto · Oanisha Maneno · ${puzzlePairs.length}/${puzzlePairs.length}`}
              onClose={() => setShowWin(false)} />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-bold text-umber-400 uppercase tracking-widest text-center mb-1">Kiswahili</p>
            {puzzlePairs.map(pair => {
              const isMatched = matched.includes(pair.swahili)
              const isWrong = wrongFlash === pair.swahili
              return (
                <button key={pair.swahili} onClick={() => !isMatched && tapSwahili(pair.swahili)}
                  className={`w-full py-3 px-4 rounded-2xl font-bold text-sm transition-all ${
                    isMatched ? 'bg-savanna-100 text-savanna-700 border-2 border-savanna-300' :
                    isWrong ? 'bg-maasai-100 text-maasai-700 border-2 border-maasai-400 animate-pulse' :
                    selectedSw === pair.swahili ? 'border-2 border-ochre-500 bg-ochre-50 text-ochre-700' :
                              'bg-white border-2 border-sand-200 text-umber-700 shadow-soft'
                  }`}>
                  {pair.swahili} {isMatched && <Check className="inline w-3.5 h-3.5 ml-1"/>}
                </button>
              )
            })}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-bold text-umber-400 uppercase tracking-widest text-center mb-1">Kiingereza</p>
            {englishShuffled.map(en => {
              const isMatched = matchedEnglish.includes(en)
              return (
                <button key={en} onClick={() => !isMatched && tapEnglish(en)}
                  className={`w-full py-3 px-4 rounded-2xl font-semibold text-sm transition-all ${
                    isMatched ? 'bg-savanna-100 text-savanna-700 border-2 border-savanna-300' :
                                'bg-white border-2 border-sand-200 text-umber-600 shadow-soft hover:border-cobalt-300'
                  }`}>
                  {en} {isMatched && <Check className="inline w-3.5 h-3.5 ml-1"/>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
