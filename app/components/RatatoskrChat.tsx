'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Tune this to change typing speed ──────────────────────────────────────────
const TYPEWRITER_SPEED = 55 // characters per second — higher = faster
// ──────────────────────────────────────────────────────────────────────────────

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    let i = 0
    const ms = 1000 / TYPEWRITER_SPEED
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, ms)
    return () => clearInterval(interval)
  }, [text])

  return (
    <span>
      {displayed}
      {!done && <span className="animate-pulse opacity-70">▍</span>}
    </span>
  )
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RatatoskrChatProps {
  open: boolean
  onClose: () => void
}

const GREETING: Message = {
  role: 'assistant',
  content: "Greetings, traveller! I am Ratatoskr — messenger of Yggdrasil. This world was crafted by Motheo Molefi as a living showcase of his work: a single place where all his projects dwell, waiting to be discovered. Ask me anything about him or what he's built.",
}

export default function RatatoskrChat({ open, onClose }: RatatoskrChatProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
    } else {
      inputRef.current?.blur()
    }
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply ?? "The branches stir but carry no words. Try again." },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I seem to have lost my footing on the branches. Try again!" },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return // don't stop propagation, don't prevent default
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
    // Stop everything else (e.g. R) from bubbling up and toggling the chat mid-type
    e.stopPropagation()
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-50 flex flex-col rounded-2xl overflow-hidden pointer-events-auto"
      style={{
        width: '340px',
        height: '480px',
        background: 'rgba(140, 140, 160, 0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🐿️</span>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Ratatoskr</p>
            <p className="text-white/60 text-[10px] uppercase tracking-widest mt-0.5">Messenger of Yggdrasil</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255, 255, 255, 0.3)' }}
        >
          R
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin">
        {messages.map((msg, i) => {
          const isLatestAssistant = msg.role === 'assistant' && i === messages.length - 1
          return (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[82%] text-sm leading-relaxed rounded-xl px-3 py-2"
                style={
                  msg.role === 'user'
                    ? { background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }
                    : { background: 'rgba(0, 0, 0, 0.25)', color: 'rgba(255, 255, 255, 0.9)' }
                }
              >
                {isLatestAssistant && open
                  ? <TypewriterText key={msg.content} text={msg.content} />
                  : msg.content}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div
              className="text-sm rounded-xl px-3 py-2"
              style={{ background: 'rgba(0, 0, 0, 0.25)', color: 'rgba(255, 255, 255, 0.5)' }}
            >
              <span className="animate-pulse">Scurrying up the branches…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-3 py-3 shrink-0 flex gap-2 items-center"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          disabled={loading}
          className="flex-1 bg-transparent text-white text-sm placeholder-white/40 outline-none"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(255, 255, 255, 0.3)' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
