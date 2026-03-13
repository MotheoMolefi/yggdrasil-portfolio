'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Tune this to change typing speed ──────────────────────────────────────────
const TYPEWRITER_SPEED = 30 // characters per second — higher = faster
// ──────────────────────────────────────────────────────────────────────────────

// Split text on URLs and render links as clickable anchors
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#a8d8ff', textDecoration: 'underline' }}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  )
}

function TypewriterText({
  text,
  onCharTyped,
  onDone,
}: {
  text: string
  onCharTyped?: () => void
  onDone?: () => void
}) {
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
      onCharTyped?.()
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
        onDone?.()
      }
    }, ms)
    return () => clearInterval(interval)
  }, [text, onCharTyped, onDone])

  return (
    <span>
      {linkify(displayed)}
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
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onAssistantResponse?: () => void
  onNavigate?: (key: string) => void
  themePalette?: {
    panelBg: string
    panelBorder: string
    textPrimary: string
    keyBg: string
    keyText: string
    divider: string
    chatPanelBg: string
    chatBorder: string
    chatHeaderBorder: string
    chatUserBubbleBg: string
    chatUserBubbleText: string
    chatAssistantBubbleBg: string
    chatAssistantBubbleText: string
    chatInputBorder: string
    chatSendBg: string
    linkColor: string
  }
}

const GREETING: Message = {
  role: 'assistant',
  content: "Greetings, traveller! I am Ratatoskr — messenger of Yggdrasil. This world was crafted by Motheo Molefi as a living showcase of his work: a single realm where all his projects dwell, awaiting exploration. Ask me anything about him or what he's built.",
}

export default function RatatoskrChat({ open, onClose, onMouseEnter, onMouseLeave, onAssistantResponse, onNavigate, themePalette }: RatatoskrChatProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks message indices that have already finished typing — prevents replay on reopen
  const typedIndices = useRef<Set<number>>(new Set())

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

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
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

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
      onAssistantResponse?.()
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I seem to have lost my footing on the branches. Try again!" },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
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

  const p = themePalette

  return (
    <div
      className="fixed bottom-6 left-6 z-50 flex flex-col rounded-2xl overflow-hidden pointer-events-auto"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '400px',
        height: '480px',
        background: p?.chatPanelBg ?? 'rgba(140, 140, 160, 0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: p?.chatBorder ?? '1px solid rgba(255, 255, 255, 0.15)',
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: p?.chatHeaderBorder ?? '1px solid rgba(255, 255, 255, 0.15)' }}
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
          style={{ background: p?.keyBg ?? 'rgba(255, 255, 255, 0.3)' }}
        >
          R
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 scrollbar-thin">
        {messages.map((msg, i) => {
          const isLatestAssistant = msg.role === 'assistant' && i === messages.length - 1
          const alreadyTyped = typedIndices.current.has(i)
          const shouldTypewrite = isLatestAssistant && open && !alreadyTyped
          return (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[82%] text-sm leading-relaxed rounded-xl px-3 py-2"
                style={
                  msg.role === 'user'
                    ? { background: p?.chatUserBubbleBg ?? 'rgba(255, 255, 255, 0.25)', color: p?.chatUserBubbleText ?? '#ffffff' }
                    : { background: p?.chatAssistantBubbleBg ?? 'rgba(0, 0, 0, 0.25)', color: p?.chatAssistantBubbleText ?? 'rgba(255, 255, 255, 0.9)' }
                }
              >
                {shouldTypewrite
                  ? <TypewriterText
                      key={msg.content}
                      text={msg.content}
                      onCharTyped={scrollToBottom}
                      onDone={() => { typedIndices.current.add(i) }}
                    />
                  : <span>
                      {linkify(msg.content)}
                      {isLatestAssistant && open && (
                        <span className="animate-pulse opacity-70">▍</span>
                      )}
                    </span>}
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div
              className="text-sm rounded-xl px-3 py-2"
              style={{ background: p?.chatAssistantBubbleBg ?? 'rgba(0, 0, 0, 0.25)', color: 'rgba(255, 255, 255, 0.5)' }}
            >
              <span className="animate-pulse">Scurrying up the branches…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="px-3 py-3 shrink-0 flex gap-2 items-center"
        style={{ borderTop: p?.chatInputBorder ?? '1px solid rgba(255, 255, 255, 0.15)' }}
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
          style={{ background: p?.chatSendBg ?? 'rgba(255, 255, 255, 0.3)' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
