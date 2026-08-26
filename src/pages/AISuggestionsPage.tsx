import { useState, useRef, useEffect } from 'react'
import { Send, Bot, CheckCircle, FileText } from 'lucide-react'
import type { Page } from '../App'

type PlanStep = { title: string; description: string; timeframe: string }

type GeneratedPlan = {
  problem: string
  steps: PlanStep[]
  volunteers: string
  duration: string
  materials: string[]
  budget: string
  safety: string
  expectedOutcome: string
}

type Props = { onNavigate: (page: Page) => void }

const quickActions = [
  { icon: '📋', label: 'Create an Action Plan', desc: 'Step-by-step guide for any community problem' },
  { icon: '👥', label: 'Estimate Volunteers Needed', desc: 'How many people are required?' },
  { icon: '🪛', label: 'Suggest Materials', desc: 'What tools and supplies are needed?' },
  { icon: '⏱️', label: 'Estimate Project Duration', desc: 'How long will this take?' },
  { icon: '🎯', label: 'Prioritize Community Issues', desc: 'Which problem needs attention first?' },
]

type Message = { id: number; role: 'user' | 'ai'; text: string }

export default function AISuggestionsPage({ onNavigate: _ }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'ai', text: 'Hello! I am the Community Action Bridge AI Planner.\n\nTell me about a problem in your community and I will create a practical action plan to solve it. You can also ask me to estimate volunteers, materials, or project cost.' }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState('')
  const [planUsed, setPlanUsed] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<GeneratedPlan | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = async (text: string) => {
    if (!text.trim() || typing) return

    const userMsg: Message = { id: Date.now(), role: 'user', text }
    setMessages((p) => [...p, userMsg])
    setInput('')
    setTyping(true)
    setError('')

    try {
      const response = await fetch('http://localhost:5000/api/ai/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      })
      const data = await response.json() as { success?: boolean; response?: string; message?: string; plan?: GeneratedPlan }

      if (!response.ok || !data.success || !data.response) {
        throw new Error(data.message || 'AI planner could not process your request.')
      }

      setMessages((p) => [...p, { id: Date.now() + 1, role: 'ai', text: data.response! }])
      if (data.plan) {
        setCurrentPlan(data.plan)
        setPlanUsed(false)
      }
    } catch (err) {
      console.error('AI planner error:', err)
      const errorMsg = err instanceof TypeError
        ? 'Unable to connect to the AI service. Is the backend running?'
        : err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      setError(errorMsg)
      setMessages((p) => [...p, { id: Date.now() + 1, role: 'ai', text: `Sorry, I encountered an error: ${errorMsg}` }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="max-w-[1000px] space-y-5 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-700 text-slate-900 flex items-center gap-2">
          <Bot size={22} className="text-blue-500" /> AI Community Planner
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Get practical suggestions for solving community problems.</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left — Quick actions + sample plan */}
        <div className="space-y-5">
          {/* Quick action cards */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-4">What can I help with?</h3>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => send(a.label)}
                  disabled={typing}
                  className="w-full flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl flex-shrink-0">{a.icon}</span>
                  <div>
                    <div className="text-xs font-700 text-slate-700 group-hover:text-blue-700 transition-colors">{a.label}</div>
                    <div className="text-[11px] text-slate-400">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sample prompts */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="text-xs font-700 text-blue-800 mb-2">Try asking:</div>
            {[
              '"How can we solve this flooding problem?"',
              '"How many volunteers do we need?"',
              '"What materials are required?"',
              '"Estimate the cost in Taka"',
            ].map((q) => (
              <button
                key={q}
                onClick={() => send(q.replace(/"/g, ''))}
                disabled={typing}
                className="block w-full text-left text-xs text-blue-600 hover:text-blue-800 py-1.5 cursor-pointer transition-colors font-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Right — Chat */}
        <div className="col-span-2 space-y-5">
          {/* Chat window */}
          <div className="bg-white rounded-2xl card-shadow flex flex-col overflow-hidden" style={{ height: '420px' }}>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-700 text-slate-800">CAB AI Planner</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-slate-400">AI-powered • Suggestions only</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'ai' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-green-400 to-green-500'
                  }`}>
                    {msg.role === 'ai' ? <Bot size={14} className="text-white" /> : <span className="text-white text-[10px] font-700">RK</span>}
                  </div>
                  <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                      msg.role === 'ai'
                        ? 'bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm'
                        : 'bg-green-500 text-white rounded-tr-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1 h-10">
                    {[0,1,2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder={typing ? "AI is thinking..." : "Describe a community problem..."}
                disabled={typing}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || typing}
                className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white hover:bg-blue-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* Action Plan */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-700 text-slate-800">Action Plan</h3>
                {currentPlan ? (
                  <p className="text-xs text-slate-400 mt-0.5">Generated by AI for your community problem</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">Describe a community problem above to generate an action plan</p>
                )}
              </div>
              {currentPlan && (
                <span className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-700 flex items-center gap-1">
                  <CheckCircle size={11} /> AI Generated
                </span>
              )}
            </div>

            {currentPlan ? (
              <>
                <div className="bg-slate-50 rounded-xl p-3.5 mb-4">
                  <div className="text-xs text-slate-500 mb-1">Problem</div>
                  <div className="text-sm font-600 text-slate-800">{currentPlan.problem}</div>
                </div>

                <div className="mb-4">
                  <div className="text-xs font-700 text-slate-700 mb-2.5">Suggested Steps</div>
                  <div className="space-y-2">
                    {currentPlan.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-700 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                        <div className="flex-1">
                          <div className="text-sm font-600 text-slate-700">{step.title}</div>
                          <div className="text-xs text-slate-500 leading-snug mt-0.5">{step.description}</div>
                          {step.timeframe && <div className="text-[11px] text-blue-600 mt-0.5 font-600">⏱ {step.timeframe}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { emoji: '👥', label: 'Volunteers', value: currentPlan.volunteers },
                    { emoji: '⏱️', label: 'Duration', value: currentPlan.duration },
                    { emoji: '💰', label: 'Estimated Cost', value: currentPlan.budget },
                    { emoji: '⚠️', label: 'Safety Note', value: currentPlan.safety.length > 50 ? currentPlan.safety.slice(0, 50) + '...' : currentPlan.safety },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span>{item.emoji}</span>
                        <div className="text-[11px] font-700 text-slate-500">{item.label}</div>
                      </div>
                      <div className="text-xs font-700 text-slate-800">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-4">
                  <div className="text-xs font-700 text-slate-700 mb-2">Materials Needed</div>
                  <div className="flex flex-wrap gap-2">
                    {currentPlan.materials.map((m) => (
                      <span key={m} className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-600">{m}</span>
                    ))}
                  </div>
                </div>

                {currentPlan.expectedOutcome && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4">
                    <div className="text-[11px] font-700 text-green-700 mb-0.5">Expected Outcome</div>
                    <div className="text-xs text-green-800">{currentPlan.expectedOutcome}</div>
                  </div>
                )}

                <button
                  onClick={() => setPlanUsed(true)}
                  className={`w-full py-3.5 rounded-xl text-sm font-700 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    planUsed
                      ? 'bg-green-50 border-2 border-green-400 text-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-100'
                  }`}
                >
                  {planUsed ? <><CheckCircle size={16} /> Plan Adopted!</> : '✅ Use This Plan'}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <FileText size={24} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 font-500">Describe a community problem above to generate an action plan.</p>
                <p className="text-xs text-slate-400 mt-1">The AI will create a tailored plan with steps, materials, budget, and more.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
