import { useState, useEffect } from 'react'
import { Plus, Trash2, Sun, Moon, Languages, Layers } from 'lucide-react'

const translations = {
  en: {
    title: 'MTU Calculator',
    subtitle: 'Calculate effective MTU and MSS for chained tunnel encapsulations. Everything client-side.',
    baseMtu: 'Base MTU (bytes)',
    baseMtuDesc: 'Physical interface MTU (typically 1500 for Ethernet)',
    encapsulations: 'Encapsulation chain',
    addEncap: 'Add encapsulation',
    remove: 'Remove',
    results: 'Results',
    effectiveMtu: 'Effective MTU',
    mss: 'TCP MSS',
    mssNote: 'MSS = Effective MTU - 40 (20 IP + 20 TCP headers)',
    totalOverhead: 'Total overhead',
    overhead: 'Overhead',
    type: 'Type',
    bytes: 'bytes',
    noEncap: 'No encapsulations added. Add one above.',
    builtBy: 'Built by',
    mssWarning: 'MSS below 576 bytes — may cause connectivity issues',
    mtuOk: 'MTU looks healthy',
    mtuTight: 'Consider jumbo frames on the physical link',
    selectType: 'Select encapsulation type',
    customOverhead: 'Custom overhead (bytes)',
  },
  pt: {
    title: 'Calculadora de MTU',
    subtitle: 'Calcule o MTU efetivo e MSS para encapsulamentos em cadeia. Tudo no navegador.',
    baseMtu: 'MTU base (bytes)',
    baseMtuDesc: 'MTU da interface fisica (tipicamente 1500 para Ethernet)',
    encapsulations: 'Cadeia de encapsulamento',
    addEncap: 'Adicionar encapsulamento',
    remove: 'Remover',
    results: 'Resultados',
    effectiveMtu: 'MTU Efetivo',
    mss: 'TCP MSS',
    mssNote: 'MSS = MTU Efetivo - 40 (20 IP + 20 TCP headers)',
    totalOverhead: 'Overhead total',
    overhead: 'Overhead',
    type: 'Tipo',
    bytes: 'bytes',
    noEncap: 'Nenhum encapsulamento adicionado. Adicione acima.',
    builtBy: 'Criado por',
    mssWarning: 'MSS abaixo de 576 bytes — pode causar problemas de conectividade',
    mtuOk: 'MTU saudavel',
    mtuTight: 'Considere jumbo frames na interface fisica',
    selectType: 'Selecionar tipo de encapsulamento',
    customOverhead: 'Overhead customizado (bytes)',
  },
} as const

type Lang = keyof typeof translations

interface EncapType {
  id: string
  name: string
  overhead: number
  note: string
}

const ENCAP_TYPES: Omit<EncapType, 'id'>[] = [
  { name: 'GRE', overhead: 24, note: '4B GRE + 20B outer IP' },
  { name: 'GRE + IPsec (ESP Transport)', overhead: 50, note: '4B GRE + 20B outer IP + 26B ESP' },
  { name: 'IPsec ESP (Tunnel, AES-128/SHA-256)', overhead: 73, note: '20B outer IP + 8B ESP hdr + 16B IV + 12B ICV + 2B pad + 1B pad-len + 1B next-hdr' },
  { name: 'IPsec ESP (Tunnel, AES-256/SHA-384)', overhead: 89, note: '20B outer IP + 8B ESP hdr + 16B IV + 24B ICV + 2B pad + 1B pad-len + 1B next-hdr' },
  { name: 'VXLAN', overhead: 50, note: '8B VXLAN + 8B UDP + 20B outer IP + 14B outer Ethernet' },
  { name: 'GENEVE', overhead: 50, note: '~8B GENEVE + 8B UDP + 20B outer IP + 14B outer Ethernet' },
  { name: 'PPPoE', overhead: 8, note: '6B PPPoE + 2B PPP protocol' },
  { name: '6in4 (IPv6 over IPv4)', overhead: 20, note: '20B outer IPv4' },
  { name: '4in6 (IPv4 over IPv6)', overhead: 40, note: '40B outer IPv6' },
  { name: 'WireGuard', overhead: 60, note: '20B outer IP + 8B UDP + 32B WireGuard header' },
  { name: 'L2TP (no IPsec)', overhead: 32, note: '20B outer IP + 8B UDP + 4B L2TP' },
  { name: 'OpenVPN (UDP)', overhead: 44, note: '20B outer IP + 8B UDP + 16B OpenVPN' },
  { name: 'MPLS (1 label)', overhead: 4, note: '4B per label' },
  { name: 'MPLS (2 labels)', overhead: 8, note: '4B per label x2' },
  { name: 'MPLS (3 labels)', overhead: 12, note: '4B per label x3' },
  { name: 'NVGRE', overhead: 42, note: '4B NVGRE + 4B GRE + 14B outer Ethernet + 20B outer IP' },
  { name: 'Custom', overhead: 0, note: 'Enter custom overhead' },
]

interface EncapEntry {
  uid: string
  typeIdx: number
  customOverhead: number
}

function uid() { return Math.random().toString(36).slice(2) }

export default function MtuCalculator() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('pt') ? 'pt' : 'en'))
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [baseMtu, setBaseMtu] = useState(1500)
  const [encaps, setEncaps] = useState<EncapEntry[]>([])

  const t = translations[lang]
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const addEncap = () => setEncaps(e => [...e, { uid: uid(), typeIdx: 0, customOverhead: 24 }])
  const remove = (id: string) => setEncaps(e => e.filter(x => x.uid !== id))
  const updateType = (id: string, idx: number) => setEncaps(e => e.map(x => x.uid === id ? { ...x, typeIdx: idx } : x))
  const updateCustom = (id: string, v: number) => setEncaps(e => e.map(x => x.uid === id ? { ...x, customOverhead: v } : x))

  const overheadOf = (entry: EncapEntry) => {
    const type = ENCAP_TYPES[entry.typeIdx]
    return type.name === 'Custom' ? entry.customOverhead : type.overhead
  }

  const totalOverhead = encaps.reduce((sum, e) => sum + overheadOf(e), 0)
  const effectiveMtu = baseMtu - totalOverhead
  const mss = effectiveMtu - 40

  const runningMtu: number[] = []
  let running = baseMtu
  for (const e of encaps) {
    running -= overheadOf(e)
    runningMtu.push(running)
  }

  const statusColor = effectiveMtu < 576 ? 'text-red-500' : effectiveMtu < 1000 ? 'text-amber-500' : 'text-teal-500' // actually orange but we use accent

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors">
      <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="font-semibold">MTU Calculator</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <Languages size={14} />{lang.toUpperCase()}
            </button>
            <button onClick={() => setDark(d => !d)} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href="https://github.com/gmowses/mtu-calculator" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold">{t.title}</h1>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: config */}
            <div className="space-y-6">
              {/* Base MTU */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
                <div>
                  <h2 className="font-semibold">{t.baseMtu}</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t.baseMtuDesc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setBaseMtu(b => Math.max(576, b - 1))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">-</button>
                  <input type="number" min={576} max={9216} value={baseMtu} onChange={e => setBaseMtu(Math.max(576, Math.min(9216, Number(e.target.value))))}
                    className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 font-mono text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  <button onClick={() => setBaseMtu(b => Math.min(9216, b + 1))} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">+</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[576, 1492, 1500, 1508, 9000, 9216].map(v => (
                    <button key={v} onClick={() => setBaseMtu(v)}
                      className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${baseMtu === v ? 'bg-orange-500 border-orange-500 text-white' : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Encapsulations */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
                <h2 className="font-semibold">{t.encapsulations}</h2>
                {encaps.length === 0 && <p className="text-sm text-zinc-400">{t.noEncap}</p>}
                {encaps.map((e, i) => {
                  const isCustom = ENCAP_TYPES[e.typeIdx].name === 'Custom'
                  const oh = overheadOf(e)
                  return (
                    <div key={e.uid} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500">Layer {i + 1}</span>
                        <button onClick={() => remove(e.uid)} className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </div>
                      <select value={e.typeIdx} onChange={ev => updateType(e.uid, Number(ev.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                        {ENCAP_TYPES.map((et, idx) => (
                          <option key={idx} value={idx}>{et.name} (-{et.overhead}B)</option>
                        ))}
                      </select>
                      {isCustom && (
                        <input type="number" min={0} max={500} value={e.customOverhead} onChange={ev => updateCustom(e.uid, Number(ev.target.value))}
                          placeholder={t.customOverhead}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500" />
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-400">{ENCAP_TYPES[e.typeIdx].note}</span>
                        <span className="font-mono font-semibold text-orange-500">-{oh}B</span>
                      </div>
                      <div className="text-xs text-zinc-400">MTU after: <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-200">{runningMtu[i]} B</span></div>
                    </div>
                  )
                })}
                <button onClick={addEncap} className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 py-2.5 text-sm text-zinc-500 hover:border-orange-500 hover:text-orange-500 transition-colors">
                  <Plus size={14} />{t.addEncap}
                </button>
              </div>
            </div>

            {/* Right: results */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-6">
              <h2 className="font-semibold">{t.results}</h2>

              <div className="grid gap-4">
                <div className="rounded-xl border-2 border-orange-500/30 bg-orange-50 dark:bg-orange-900/10 p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">{t.effectiveMtu}</p>
                  <p className={`text-5xl font-bold tabular-nums ${statusColor}`}>{effectiveMtu}</p>
                  <p className="text-xs text-zinc-400 mt-1">{t.bytes}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 text-center">
                  <p className="text-xs uppercase tracking-wide text-zinc-400 mb-1">{t.mss}</p>
                  <p className="text-4xl font-bold tabular-nums text-zinc-700 dark:text-zinc-200">{mss}</p>
                  <p className="text-xs text-zinc-400 mt-1">{t.bytes}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-400 mb-0.5">{t.totalOverhead}</p>
                  <p className="text-2xl font-bold tabular-nums text-red-500">-{totalOverhead} <span className="text-sm font-normal text-zinc-400">{t.bytes}</span></p>
                </div>
              </div>

              <p className="text-xs text-zinc-400">{t.mssNote}</p>

              {mss < 576 && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-xs text-red-600 dark:text-red-400">
                  {t.mssWarning}
                </div>
              )}

              {/* Visual stacking */}
              {encaps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Stack</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded flex items-center justify-center font-mono font-semibold text-zinc-700 dark:text-zinc-200 transition-all" style={{ width: `${(baseMtu / (baseMtu + 50)) * 100}%`, minWidth: '60px' }}>
                        {baseMtu}B
                      </div>
                      <span className="text-zinc-400 shrink-0">base</span>
                    </div>
                    {encaps.map((e, i) => (
                      <div key={e.uid} className="flex items-center gap-2 text-xs">
                        <div className="h-6 bg-orange-400/70 rounded flex items-center justify-center font-mono font-semibold text-white transition-all"
                          style={{ width: `${(runningMtu[i] / (baseMtu + 50)) * 100}%`, minWidth: '60px' }}>
                          {runningMtu[i]}B
                        </div>
                        <span className="text-zinc-400 shrink-0">-{overheadOf(e)}B {ENCAP_TYPES[e.typeIdx].name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-zinc-400">
          <span>{t.builtBy} <a href="https://github.com/gmowses" className="text-zinc-600 dark:text-zinc-300 hover:text-orange-500 transition-colors">Gabriel Mowses</a></span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  )
}
