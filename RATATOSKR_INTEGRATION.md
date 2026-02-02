# 🐿️ Ratatoskr AI Integration Guide

This guide will help you integrate an LLM-powered chatbot (Ratatoskr) into your Yggdrasil portfolio.

## Overview

Ratatoskr will serve as an intelligent guide that can:
- Answer questions about your projects and skills
- Help recruiters navigate your portfolio
- Provide personalized recommendations
- Share insights about your experience

## Option 1: OpenAI Integration

### Setup

1. Get an API key from [OpenAI](https://platform.openai.com/)

2. Install the OpenAI SDK:
```bash
npm install openai
```

3. Create environment variable:
```bash
# .env.local
VITE_OPENAI_API_KEY=your_key_here
```

### Implementation

Create `src/services/openai.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo! Use backend in production
});

const SYSTEM_PROMPT = `You are Ratatoskr, the messenger squirrel from Norse mythology, 
serving as a guide through this portfolio. You are knowledgeable, witty, and helpful.

Portfolio Owner: [Your Name]
Background: [Your background]
Skills: [Your key skills]

Key Projects:
[List your main projects with details]

Answer questions helpfully and guide visitors through the portfolio.`;

export async function chatWithRatatoskr(
  message: string,
  history: Array<{ role: string; content: string }>
) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message }
    ],
    temperature: 0.7,
    max_tokens: 500
  });

  return response.choices[0].message.content;
}
```

## Option 2: Anthropic Claude Integration

### Setup

1. Get an API key from [Anthropic](https://www.anthropic.com/)

2. Install the Anthropic SDK:
```bash
npm install @anthropic-ai/sdk
```

3. Create environment variable:
```bash
# .env.local
VITE_ANTHROPIC_API_KEY=your_key_here
```

### Implementation

Create `src/services/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Only for demo! Use backend in production
});

const SYSTEM_PROMPT = `You are Ratatoskr, the swift messenger squirrel from Norse mythology...`;

export async function chatWithRatatoskr(
  message: string,
  history: Array<{ role: string; content: string }>
) {
  const response = await anthropic.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history.concat([
      { role: 'user', content: message }
    ])
  });

  return response.content[0].text;
}
```

## Update the UI Component

Replace `src/components/RatatoskrPlaceholder.tsx` with a full chat interface:

```typescript
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { chatWithRatatoskr } from '../services/openai'; // or claude

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Ratatoskr() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Greetings! I am Ratatoskr, your guide through this portfolio. What would you like to know?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const showRatatoskr = useStore((state) => state.showRatatoskr);
  const setShowRatatoskr = useStore((state) => state.setShowRatatoskr);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithRatatoskr(
        input,
        messages.map(m => ({ role: m.role, content: m.content }))
      );
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Apologies, I seem to have lost my way momentarily. Could you try again?'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {showRatatoskr && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-6 right-6 w-96 h-[600px] bg-gradient-to-br from-yggdrasil-dark/95 to-gray-900/95 backdrop-blur-lg border border-yggdrasil-gold/30 rounded-2xl shadow-2xl z-40 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-yggdrasil-gold/20">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-3xl">🐿️</span>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-4 h-4 text-yggdrasil-gold" />
                </motion.div>
              </div>
              <div>
                <h3 className="font-norse font-semibold text-white">Ratatoskr</h3>
                <p className="text-xs text-gray-400">Messenger of Yggdrasil</p>
              </div>
            </div>
            <button
              onClick={() => setShowRatatoskr(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-yggdrasil-gold text-yggdrasil-dark'
                      : 'bg-yggdrasil-rune/20 text-white'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-yggdrasil-rune/20 text-white p-3 rounded-lg">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-yggdrasil-gold/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Ratatoskr anything..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yggdrasil-gold/50"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-yggdrasil-gold text-yggdrasil-dark rounded-lg hover:bg-yggdrasil-gold/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## Security Best Practices

### ⚠️ IMPORTANT: Don't expose API keys in frontend!

For production, create a backend API:

```typescript
// backend/api/chat.ts (Next.js API route example)
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Server-side only!
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: message }
      ]
    });

    res.status(200).json({
      message: response.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get response' });
  }
}
```

Then update your frontend to call this endpoint:

```typescript
export async function chatWithRatatoskr(message: string, history: Message[]) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });

  const data = await response.json();
  return data.message;
}
```

## Training Data

Create a knowledge base about yourself:

```typescript
const PORTFOLIO_DATA = {
  name: "Your Name",
  role: "Software Engineer",
  experience: "5 years",
  skills: ["React", "TypeScript", "Node.js", "Python", "etc"],
  projects: [
    {
      name: "Project 1",
      description: "...",
      technologies: ["..."],
      highlights: ["...", "..."]
    }
  ],
  education: "...",
  interests: "...",
  contact: "..."
};
```

Include this in your system prompt to give Ratatoskr accurate information.

## Example Prompts

Train Ratatoskr to handle:
- "What projects has [Name] worked on?"
- "Tell me about their experience with React"
- "What's their strongest skill?"
- "How can I contact them?"
- "What makes this portfolio unique?"

## Rate Limiting

Implement rate limiting to control costs:

```typescript
// Simple client-side rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds

export async function chatWithRatatoskr(message: string, history: Message[]) {
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    throw new Error('Please wait a moment before sending another message');
  }
  lastRequestTime = now;
  
  // ... rest of implementation
}
```

## Testing

Test with various questions:
- Technical questions about projects
- Career-related inquiries
- Navigation help
- Edge cases and unusual queries

---

Happy coding! 🐿️✨

