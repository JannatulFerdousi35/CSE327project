import { useState } from 'react'
import { Send, Bot, CheckCircle, AlertTriangle } from 'lucide-react'
import type { Page } from '../App'

type Props = { onNavigate: (page: Page) => void }

const quickActions = [
  { icon: '📋', label: 'Create an Action Plan', desc: 'Step-by-step guide for any community problem' },
  { icon: '👥', label: 'Estimate Volunteers Needed', desc: 'How many people are required?' },
  { icon: '🪛', label: 'Suggest Materials', desc: 'What tools and supplies are needed?' },
  { icon: '⏱️', label: 'Estimate Project Duration', desc: 'How long will this take?' },
  { icon: '🎯', label: 'Prioritize Community Issues', desc: 'Which problem needs attention first?' },
]

const samplePlan = {
  problem: 'Waterlogging on the road near Jamurki Primary School.',
  steps: [
    'Identify the blocked drainage points near the school gate',
    'Organise 8–10 volunteers from the local community',
    'Arrange shovels, gloves, and waste bags',
    'Clean all blocked drainage channels manually',
    'Monitor the road condition after the next rainfall',
  ],
  volunteers: '8–10 people',
  time: '1–2 days',
  materials: ['Shovels (5)', 'Rubber gloves (10 pairs)', 'Waste bags (20)', 'Sandbags (10)'],
  budget: '৳3,000–৳5,000',
  safety: 'Wear gloves at all times. Avoid working in active rain. Keep children away from the work area.',
}

type Message = { id: number; role: 'user' | 'ai'; text: string }

const aiReplies: Record<string, string> = {
  solve: `Here is a step-by-step plan for the Jamurki road waterlogging:\n\n1. Identify blocked drain points\n2. Organise 8–10 volunteers\n3. Arrange tools: shovels, gloves, sandbags\n4. Clear the drain in sections\n5. Monitor after next rainfall\n\nEstimated cost: ৳3,000–৳5,000\nEstimated time: 1–2 days`,
  volunteer: `For this road waterlogging issue:\n\nRequired: 8–10 volunteers\nSkills needed: General labour (no special skills)\nRecommended schedule: Early morning (7–11 AM) to avoid heat\n\nTip: Contact the local Union Parishad to coordinate volunteers.`,
  material: `Materials needed for drain clearing:\n\n• 5 shovels\n• 10 pairs rubber gloves\n• 20 waste bags\n• 10 sandbags (temporary barrier)\n• 2 rakes\n\nEstimated cost: ৳1,500–৳2,000\nAvailable at: Local hardware store or Union Parishad store`,
  budget: `Estimated budget for drain repair:\n\nLabour (volunteer): ৳0\nShovels (5): ৳1,500\nGloves (10 pairs): ৳300\nWaste bags (20): ৳200\nSandbags (10): ৳500\nMiscellaneous: ৳500\n\nTotal: ৳3,000–৳5,000\n\n* These are estimates. Actual costs may vary.`,
  default: `I can help you plan how to solve community problems step by step. Try asking:\n\n• "How do we solve the flooding near the school?"\n• "How many volunteers do we need?"\n• "What materials are required?"\n• "Estimate the cost of this project"`,
}

function findReply(text: string): string {
  const lower = text.toLowerCase()
  if (lower.includes('volunteer') || lower.includes('people')) return aiReplies.volunteer
  if (lower.includes('material') || lower.includes('tool') || lower.includes('supply')) return aiReplies.material
  if (lower.includes('cost') || lower.includes('budget') || lower.includes('taka') || lower.includes('money')) return aiReplies.budget
  if (lower.includes('solve') || lower.includes('plan') || lower.includes('flood') || lower.includes('road') || lower.includes('water')) return aiReplies.solve
  return aiReplies.default
}

export default function AISuggestionsPage({ onNavigate: _ }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'ai', text: 'Hello! I am the Community Action Bridge AI Planner.\n\nTell me about a problem in your community and I will create a practical action plan to solve it. You can also ask me to estimate volunteers, materials, or project cost.' }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [planUsed, setPlanUsed] = useState(false)

  const send = (text: string) => {
    if (!text.trim() || typing) return
    const userMsg: Message = { id: Date.now(), role: 'user', text }
    setMessages((p) => [...p, userMsg])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages((p) => [...p, { id: Date.now() + 1, role: 'ai', text: findReply(text) }])
    }, 1600)
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
        {/* Left — Quick actions + suggested plan */}
        <div className="space-y-5">
          {/* Quick action cards */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="text-sm font-700 text-slate-800 mb-4">What can I help with?</h3>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => send(a.label)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer text-left group"
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
                className="block w-full text-left text-xs text-blue-600 hover:text-blue-800 py-1.5 cursor-pointer transition-colors font-500"
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
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Describe a community problem..."
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
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

          {/* Suggested Action Plan — always visible */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-700 text-slate-800">Sample Action Plan</h3>
                <p className="text-xs text-slate-400 mt-0.5">AI-generated plan — verify with local knowledge</p>
              </div>
              <span className="text-[11px] px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full font-700 flex items-center gap-1">
                <AlertTriangle size={11} /> AI Suggestion
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4">
              <div className="text-xs text-slate-500 mb-1">Problem</div>
              <div className="text-sm font-600 text-slate-800">{samplePlan.problem}</div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-700 text-slate-700 mb-2.5">Suggested Steps</div>
              <div className="space-y-2">
                {samplePlan.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-700 flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                    <span className="text-sm text-slate-600 leading-snug">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { emoji: '👥', label: 'Volunteers', value: samplePlan.volunteers },
                { emoji: '⏱️', label: 'Duration', value: samplePlan.time },
                { emoji: '💰', label: 'Estimated Cost', value: samplePlan.budget },
                { emoji: '⚠️', label: 'Safety Note', value: samplePlan.safety.slice(0, 40) + '...' },
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
                {samplePlan.materials.map((m) => (
                  <span key={m} className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-600">{m}</span>
                ))}
              </div>
            </div>

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
          </div>
        </div>
      </div>
    </div>
  )
}
