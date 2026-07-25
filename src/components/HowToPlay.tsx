import { X } from 'lucide-react'
import { navigate } from '../lib/router'

// How-to-play sheet. Shown from the nav ("Jinsi ya kucheza") and once from the
// first-load welcome screen, where closing it drops the player onto the board.
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-umber-700/40 animate-fade-in p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-sand-100 rounded-3xl p-6 shadow-card animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-black text-umber-700">Jinsi ya kucheza</h3>
          <button onClick={onClose} className="text-umber-400"><X className="w-5 h-5"/></button>
        </div>

        <p className="text-umber-600 mb-4">
          Bahatisha neno la Kiswahili kwa majaribio 6. Kila jaribio lazima liwe neno halisi la Kiswahili
          lenye urefu sahihi. Baada ya kila jaribio, vigae hubadilika rangi:
        </p>

        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-savanna-500 flex items-center justify-center text-white font-black">S</div>
            <p className="text-umber-600 text-sm"><strong>Kijani</strong> — herufi sahihi, nafasi sahihi.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-saffron-400 flex items-center justify-center text-white font-black">A</div>
            <p className="text-umber-600 text-sm"><strong>Njano</strong> — imo nenoni, nafasi si sahihi.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-umber-300 flex items-center justify-center text-white font-black">O</div>
            <p className="text-umber-600 text-sm"><strong>Kijivu</strong> — haimo nenoni.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-3 shadow-soft">
          <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Neno moja kwa siku</p>
          <p className="text-umber-600 text-sm leading-relaxed">
            Mchezo wa nyumbani ni neno jipya la herufi 5 kila siku — neno moja kwa kila mtu. Litatue kwa
            majaribio machache uwezavyo ili upande juu kwenye ubao wa viongozi.
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-soft">
          <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Michezo zaidi</p>
          <p className="text-umber-600 text-sm leading-relaxed">
            Unataka zaidi? Cheza Wordle ya herufi 3, 4 na 6, tafuta-maneno ya kila siku, na mchezo wa
            kuoanisha kwenye ukurasa wa <button onClick={() => { onClose(); navigate('/games') }} className="text-ochre-500 font-bold underline">Michezo zaidi</button>.
          </p>
        </div>
      </div>
    </div>
  )
}
