# Language Teacher App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully working AI language teacher chat app with Supabase persistence, OpenRouter streaming AI, real-time feedback panel, and all 6 database tables ready.

**Architecture:** Next.js 15 App Router with server-side API Routes for OpenRouter calls (keys never exposed to client). Two parallel AI calls per message: one for teacher response (streaming), one for linguistic feedback. All data persisted in Supabase PostgreSQL.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@supabase/supabase-js`, `@supabase/ssr`, Vitest, OpenRouter API (model-agnostic)

---

## File Map

```
/app
  /page.tsx                          — Onboarding/language selector
  /chat/page.tsx                     — Main chat page
  /api/chat/route.ts                 — Streaming chat → OpenRouter
  /api/feedback/route.ts             — Linguistic analysis → OpenRouter
  /api/session/route.ts              — Create/get session
  /api/vocab/route.ts                — Add vocab cards
/components
  /chat/ChatWindow.tsx               — Chat container
  /chat/MessageBubble.tsx            — Single message with streaming
  /chat/InputBar.tsx                 — Text input + send button
  /feedback/FeedbackPanel.tsx        — Sidebar feedback display
  /feedback/ErrorCard.tsx            — Single feedback item
/lib
  /openrouter.ts                     — OpenRouter API client (streaming + JSON)
  /supabase.ts                       — Supabase browser client
  /supabase-server.ts                — Supabase server client (API routes)
  /prompts.ts                        — System prompt builder
  /types.ts                          — Shared TypeScript types
/supabase
  /migrations/001_initial.sql        — All 6 tables
/.env.local                          — API keys (not committed)
/vitest.config.ts                    — Test config
```

---

## Task 1: Initialize Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/mohammedaljohani/Documents/Proj/TR_AR
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias --eslint
```

When prompted: Yes to TypeScript, Yes to Tailwind, Yes to App Router, No to src/, No to import alias.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Create .env.local**

```
OPENROUTER_API_KEY=sk-or-REPLACE_ME
NEXT_PUBLIC_SUPABASE_URL=https://REPLACE_ME.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME
CHAT_MODEL=google/gemini-2.0-flash-001
ANALYSIS_MODEL=meta-llama/llama-3.1-8b-instruct
```

Add to `.gitignore` (append):
```
.env.local
```

- [ ] **Step 6: Verify project starts**

```bash
npm run dev
```

Expected: `✓ Ready on http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: initialize Next.js 15 project with Vitest and Supabase deps"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write types test**

Create `lib/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Language, CEFRLevel, Message, Session, VocabCard, FeedbackItem } from '../types'

describe('Types', () => {
  it('Language type accepts valid values', () => {
    const lang: Language = 'turkish'
    expect(['turkish', 'english']).toContain(lang)
  })

  it('CEFRLevel type accepts valid values', () => {
    const level: CEFRLevel = 'A1'
    expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(level)
  })

  it('Message has required fields', () => {
    const msg: Message = {
      id: '1',
      session_id: 'sess1',
      role: 'assistant',
      content: 'Merhaba!',
      xp_earned: 0,
      created_at: new Date().toISOString(),
    }
    expect(msg.role).toBe('assistant')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/__tests__/types.test.ts
```

Expected: FAIL — `Cannot find module '../types'`

- [ ] **Step 3: Create types**

Create `lib/types.ts`:

```typescript
export type Language = 'turkish' | 'english'

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  session_id: string
  role: MessageRole
  content: string
  xp_earned: number
  created_at: string
}

export interface Session {
  id: string
  language: Language
  cefr_level: CEFRLevel
  total_xp: number
  streak_days: number
  last_activity_date: string | null
  common_errors: string[]
  last_topic: string | null
  created_at: string
}

export interface VocabCard {
  id: string
  language: Language
  word: string
  translation: string
  example: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review_at: string
}

export interface FeedbackItem {
  type: 'correct' | 'correction' | 'suggestion' | 'new_vocab'
  original?: string
  correction?: string
  explanation: string
}

export interface FeedbackResponse {
  items: FeedbackItem[]
  new_vocab: Array<{ word: string; translation: string; example: string }>
  xp_earned: number
}

export interface ChatRequest {
  message: string
  language: Language
  session_id: string
  cefr_level: CEFRLevel
  known_vocab: string[]
  goals: string[]
  recent_errors: string[]
  last_topic: string | null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- lib/__tests__/types.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/__tests__/types.test.ts vitest.config.ts vitest.setup.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Supabase Clients

**Files:**
- Create: `lib/supabase.ts`, `lib/supabase-server.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase-server.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts lib/supabase-server.ts
git commit -m "feat: add Supabase browser and server clients"
```

---

## Task 4: Database Migrations

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write migration**

Create `supabase/migrations/001_initial.sql`:

```sql
-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('turkish', 'english')),
  cefr_level TEXT NOT NULL DEFAULT 'A1' CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  total_xp INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  common_errors TEXT[] DEFAULT '{}',
  last_topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vocab cards (SRS)
CREATE TABLE IF NOT EXISTS vocab_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('turkish', 'english')),
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  example TEXT NOT NULL DEFAULT '',
  ease_factor FLOAT NOT NULL DEFAULT 2.5,
  interval INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(language, word)
);

-- Feedback log
CREATE TABLE IF NOT EXISTS feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('correct', 'correction', 'suggestion', 'new_vocab')),
  original TEXT,
  correction TEXT,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL CHECK (language IN ('turkish', 'english')),
  title TEXT NOT NULL,
  is_auto BOOLEAN NOT NULL DEFAULT FALSE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Achievements (badges)
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id TEXT NOT NULL UNIQUE,
  badge_name TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vocab_review ON vocab_cards(next_review_at, language);
CREATE INDEX IF NOT EXISTS idx_feedback_message ON feedback_log(message_id);
```

- [ ] **Step 3: Run migration in Supabase**

Go to your Supabase project → SQL Editor → paste contents of `001_initial.sql` → Run.

Verify in Table Editor: all 6 tables exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_initial.sql
git commit -m "feat: add Supabase database schema with all 6 tables"
```

---

## Task 5: OpenRouter API Client

**Files:**
- Create: `lib/openrouter.ts`, `lib/__tests__/openrouter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/openrouter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildHeaders, buildChatBody, buildAnalysisBody } from '../openrouter'
import type { Language, CEFRLevel } from '../types'

describe('buildHeaders', () => {
  it('includes Authorization with Bearer token', () => {
    const headers = buildHeaders('test-key')
    expect(headers['Authorization']).toBe('Bearer test-key')
  })

  it('includes required OpenRouter headers', () => {
    const headers = buildHeaders('key')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['HTTP-Referer']).toBeDefined()
    expect(headers['X-Title']).toBeDefined()
  })
})

describe('buildChatBody', () => {
  it('includes stream: true', () => {
    const body = buildChatBody('model-id', [{ role: 'user', content: 'hi' }])
    expect(body.stream).toBe(true)
    expect(body.model).toBe('model-id')
  })

  it('passes messages correctly', () => {
    const messages = [{ role: 'user' as const, content: 'Merhaba' }]
    const body = buildChatBody('model', messages)
    expect(body.messages).toEqual(messages)
  })
})

describe('buildAnalysisBody', () => {
  it('includes stream: false for JSON response', () => {
    const body = buildAnalysisBody('model-id', 'analyze this', 'turkish')
    expect(body.stream).toBe(false)
    expect(body.response_format).toEqual({ type: 'json_object' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/__tests__/openrouter.test.ts
```

Expected: FAIL — `Cannot find module '../openrouter'`

- [ ] **Step 3: Implement OpenRouter client**

Create `lib/openrouter.ts`:

```typescript
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Language Teacher App',
  }
}

export function buildChatBody(
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) {
  return {
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  }
}

export function buildAnalysisBody(model: string, userMessage: string, language: string) {
  return {
    model,
    messages: [
      {
        role: 'system' as const,
        content: `You are a ${language} language analyst. Return ONLY valid JSON matching this schema:
{
  "items": [{"type": "correct"|"correction"|"suggestion"|"new_vocab", "original": string|null, "correction": string|null, "explanation": string}],
  "new_vocab": [{"word": string, "translation": string, "example": string}],
  "xp_earned": number
}
xp_earned: 10 for no errors, 5 for minor errors, 2 for major errors.`,
      },
      {
        role: 'user' as const,
        content: `Analyze this ${language} message: "${userMessage}"`,
      },
    ],
    stream: false,
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 500,
  }
}

export async function streamChatCompletion(
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<string>> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildChatBody(model, messages)),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${error}`)
  }

  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          controller.close()
          return
        }
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) controller.enqueue(content)
        } catch {
          // skip malformed chunks
        }
      }
    },
  })
}

export async function analyzeFeedback(
  apiKey: string,
  model: string,
  userMessage: string,
  language: string
): Promise<import('./types').FeedbackResponse> {
  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(buildAnalysisBody(model, userMessage, language)),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter feedback error ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  try {
    return JSON.parse(content)
  } catch {
    // Graceful fallback — don't crash the chat
    return { items: [], new_vocab: [], xp_earned: 2 }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- lib/__tests__/openrouter.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/__tests__/openrouter.test.ts
git commit -m "feat: add OpenRouter API client with streaming and JSON analysis"
```

---

## Task 6: System Prompt Builder

**Files:**
- Create: `lib/prompts.ts`, `lib/__tests__/prompts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, CEFR_INSTRUCTIONS } from '../prompts'
import type { Language, CEFRLevel } from '../types'

describe('buildSystemPrompt', () => {
  it('includes the language name', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('Turkish')
  })

  it('includes CEFR instructions for level', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'B1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain(CEFR_INSTRUCTIONS['B1'])
  })

  it('includes known vocab when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: ['merhaba', 'teşekkür'],
      goals: [],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('merhaba')
    expect(prompt).toContain('teşekkür')
  })

  it('includes goals when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: ['Learn greetings'],
      recent_errors: [],
      last_topic: null,
    })
    expect(prompt).toContain('Learn greetings')
  })

  it('includes recent errors when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: ['Mixing -yor and -di'],
      last_topic: null,
    })
    expect(prompt).toContain('Mixing -yor and -di')
  })

  it('mentions last topic when provided', () => {
    const prompt = buildSystemPrompt({
      language: 'turkish',
      cefr_level: 'A1',
      known_vocab: [],
      goals: [],
      recent_errors: [],
      last_topic: 'food',
    })
    expect(prompt).toContain('food')
  })
})

describe('CEFR_INSTRUCTIONS', () => {
  it('has entries for all 6 levels', () => {
    const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    for (const level of levels) {
      expect(CEFR_INSTRUCTIONS[level]).toBeDefined()
      expect(CEFR_INSTRUCTIONS[level].length).toBeGreaterThan(10)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- lib/__tests__/prompts.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement prompts**

Create `lib/prompts.ts`:

```typescript
import type { CEFRLevel, Language } from './types'

export const CEFR_INSTRUCTIONS: Record<CEFRLevel, string> = {
  A1: 'Use very simple sentences. Maximum 5-7 words per sentence. Only the most basic vocabulary. Speak slowly and clearly. Repeat key words.',
  A2: 'Use simple sentences. Introduce common everyday vocabulary. Explain new words immediately in the conversation context.',
  B1: 'Hold natural conversation. Mix familiar vocabulary with new words (explain them in context). Cover a variety of everyday topics.',
  B2: 'Speak naturally and fluidly. Use idiomatic expressions occasionally. Discuss abstract topics. Less hand-holding needed.',
  C1: 'Speak like a native. Use idioms, proverbs, and complex grammar naturally. Challenge the student with nuanced language.',
  C2: 'Complete native-level conversation. Use colloquialisms, regional expressions, and sophisticated vocabulary freely.',
}

interface PromptParams {
  language: Language
  cefr_level: CEFRLevel
  known_vocab: string[]
  goals: string[]
  recent_errors: string[]
  last_topic: string | null
}

export function buildSystemPrompt(params: PromptParams): string {
  const langName = params.language === 'turkish' ? 'Turkish' : 'English'
  const vocabSection = params.known_vocab.length > 0
    ? `\nVocabulary the student knows (use 80% of these, introduce 20% new words with in-context explanations):\n${params.known_vocab.join(', ')}`
    : '\nThe student is just starting. Use only the most basic vocabulary.'

  const goalsSection = params.goals.length > 0
    ? `\nStudent learning goals (guide conversation toward these naturally):\n${params.goals.map(g => `- ${g}`).join('\n')}`
    : ''

  const errorsSection = params.recent_errors.length > 0
    ? `\nRecent mistakes to watch for (correct gently if repeated more than twice):\n${params.recent_errors.map(e => `- ${e}`).join('\n')}`
    : ''

  const topicSection = params.last_topic
    ? `\nLast conversation topic: ${params.last_topic}. Continue naturally or introduce a related topic.`
    : ''

  return `You are a warm, encouraging ${langName} language teacher having a natural conversation with your student.

CEFR Level: ${params.cefr_level}
Instruction: ${CEFR_INSTRUCTIONS[params.cefr_level]}
${vocabSection}${goalsSection}${errorsSection}${topicSection}

Adaptation rules:
- Never correct errors directly mid-sentence — instead rephrase your response using the correct form naturally
- If the same error appears more than twice in this session, gently explain it: "By the way, in ${langName} we say..."
- When you use a new word the student may not know, briefly explain it in parentheses
- Keep responses concise and conversational (2-4 sentences max)
- End each response with a question or prompt to keep the conversation flowing
- Respond ONLY in ${langName} unless the student is completely lost`
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- lib/__tests__/prompts.test.ts
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/prompts.ts lib/__tests__/prompts.test.ts
git commit -m "feat: add adaptive system prompt builder with CEFR levels"
```

---

## Task 7: Session API Route

**Files:**
- Create: `app/api/session/route.ts`

- [ ] **Step 1: Implement session API**

Create `app/api/session/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language, CEFRLevel } from '@/lib/types'

// GET /api/session?language=turkish
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  if (!language || !['turkish', 'english'].includes(language)) {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get or create the active session for this language
  const { data: existing, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existing) {
    // Update streak
    const today = new Date().toISOString().split('T')[0]
    const lastActivity = existing.last_activity_date

    let streakDays = existing.streak_days
    if (lastActivity !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      if (lastActivity === yesterdayStr) {
        streakDays += 1
      } else if (lastActivity !== today) {
        streakDays = 1 // Reset streak
      }

      await supabase
        .from('sessions')
        .update({ streak_days: streakDays, last_activity_date: today })
        .eq('id', existing.id)
    }

    return NextResponse.json({ ...existing, streak_days: streakDays })
  }

  // Create new session
  const { data: newSession, error: createError } = await supabase
    .from('sessions')
    .insert({
      language,
      cefr_level: 'A1' as CEFRLevel,
      total_xp: 0,
      streak_days: 1,
      last_activity_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  return NextResponse.json(newSession, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/session/route.ts
git commit -m "feat: add session API route with streak tracking"
```

---

## Task 8: Vocab API Route

**Files:**
- Create: `app/api/vocab/route.ts`

- [ ] **Step 1: Implement vocab API**

Create `app/api/vocab/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import type { Language } from '@/lib/types'

// GET /api/vocab?language=turkish&known=true
export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get('language') as Language
  const knownOnly = request.nextUrl.searchParams.get('known') === 'true'

  if (!language) {
    return NextResponse.json({ error: 'Language required' }, { status: 400 })
  }

  const supabase = createServerClient()
  let query = supabase.from('vocab_cards').select('*').eq('language', language)

  if (knownOnly) {
    // Known vocab: cards reviewed at least once
    query = query.gt('repetitions', 0)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/vocab — add new vocab cards (idempotent)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { language, cards } = body as {
    language: Language
    cards: Array<{ word: string; translation: string; example: string }>
  }

  if (!language || !cards?.length) {
    return NextResponse.json({ error: 'language and cards required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('vocab_cards')
    .upsert(
      cards.map(card => ({
        language,
        word: card.word.toLowerCase().trim(),
        translation: card.translation,
        example: card.example,
      })),
      { onConflict: 'language,word', ignoreDuplicates: true }
    )
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [], { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/vocab/route.ts
git commit -m "feat: add vocab API route with idempotent upsert"
```

---

## Task 9: Feedback API Route

**Files:**
- Create: `app/api/feedback/route.ts`

- [ ] **Step 1: Implement feedback API**

Create `app/api/feedback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { analyzeFeedback } from '@/lib/openrouter'
import type { Language } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { message, language, message_id } = body as {
    message: string
    language: Language
    message_id: string
  }

  if (!message || !language || !message_id) {
    return NextResponse.json({ error: 'message, language, message_id required' }, { status: 400 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.ANALYSIS_MODEL!

  // Analyze with lightweight model — never crash the chat if this fails
  let feedback
  try {
    feedback = await analyzeFeedback(apiKey, model, message, language)
  } catch {
    return NextResponse.json({ items: [], new_vocab: [], xp_earned: 2 })
  }

  const supabase = createServerClient()

  // Save feedback items to DB
  if (feedback.items.length > 0) {
    await supabase.from('feedback_log').insert(
      feedback.items.map(item => ({
        message_id,
        type: item.type,
        original: item.original ?? null,
        correction: item.correction ?? null,
        explanation: item.explanation,
      }))
    )
  }

  // Add new vocab to SRS
  if (feedback.new_vocab.length > 0) {
    await supabase
      .from('vocab_cards')
      .upsert(
        feedback.new_vocab.map(v => ({
          language,
          word: v.word.toLowerCase().trim(),
          translation: v.translation,
          example: v.example,
        })),
        { onConflict: 'language,word', ignoreDuplicates: true }
      )
  }

  // Update session XP
  if (feedback.xp_earned > 0) {
    const { data: currentSession } = await supabase
      .from('sessions')
      .select('id, total_xp')
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (currentSession) {
      await supabase
        .from('sessions')
        .update({ total_xp: currentSession.total_xp + feedback.xp_earned })
        .eq('id', currentSession.id)
    }
  }

  return NextResponse.json(feedback)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat: add feedback API route with linguistic analysis and vocab extraction"
```

---

## Task 10: Chat API Route (Streaming)

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Implement streaming chat API**

Create `app/api/chat/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { streamChatCompletion } from '@/lib/openrouter'
import { buildSystemPrompt } from '@/lib/prompts'
import type { ChatRequest } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body: ChatRequest = await request.json()
  const { message, language, session_id, cefr_level, known_vocab, goals, recent_errors, last_topic } = body

  if (!message || !language || !session_id) {
    return new Response(JSON.stringify({ error: 'message, language, session_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.OPENROUTER_API_KEY!
  const model = process.env.CHAT_MODEL!
  const supabase = createServerClient()

  // Build system prompt with student context
  const systemPrompt = buildSystemPrompt({
    language,
    cefr_level,
    known_vocab,
    goals,
    recent_errors,
    last_topic,
  })

  // Fetch recent messages for context (last 20)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(20)

  const contextMessages = (recentMessages ?? []).reverse()

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...contextMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ]

  // Save user message first
  const { data: savedUserMsg } = await supabase
    .from('messages')
    .insert({ session_id, role: 'user', content: message, xp_earned: 0 })
    .select('id')
    .single()

  const userMessageId = savedUserMsg?.id

  // Stream response from OpenRouter
  let stream: ReadableStream<string>
  try {
    stream = await streamChatCompletion(apiKey, model, messages)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Collect full response to save to DB while streaming to client
  let fullResponse = ''
  const encoder = new TextEncoder()

  const clientStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullResponse += value
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: value })}\n\n`))
        }
      } finally {
        reader.releaseLock()

        // Save assistant message to DB
        const { data: savedAssistantMsg } = await supabase
          .from('messages')
          .insert({ session_id, role: 'assistant', content: fullResponse, xp_earned: 0 })
          .select('id')
          .single()

        // Signal completion with message IDs for feedback call
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, user_message_id: userMessageId, assistant_message_id: savedAssistantMsg?.id })}\n\n`
          )
        )
        controller.close()
      }
    },
  })

  return new Response(clientStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: add streaming chat API route with context window and DB persistence"
```

---

## Task 11: UI Components — MessageBubble

**Files:**
- Create: `components/chat/MessageBubble.tsx`

- [ ] **Step 1: Write component test**

Create `components/chat/__tests__/MessageBubble.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'

describe('MessageBubble', () => {
  it('renders user message on the right', () => {
    render(<MessageBubble role="user" content="Merhaba!" isStreaming={false} />)
    const bubble = screen.getByText('Merhaba!')
    expect(bubble).toBeInTheDocument()
  })

  it('renders assistant message on the left', () => {
    render(<MessageBubble role="assistant" content="Nasılsın?" isStreaming={false} />)
    expect(screen.getByText('Nasılsın?')).toBeInTheDocument()
  })

  it('shows streaming indicator when isStreaming is true', () => {
    render(<MessageBubble role="assistant" content="" isStreaming={true} />)
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- components/chat/__tests__/MessageBubble.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement component**

Create `components/chat/MessageBubble.tsx`:

```typescript
'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming: boolean
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 mt-1">
          T
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        }`}
      >
        {content}
        {isStreaming && (
          <span data-testid="streaming-indicator" className="inline-flex gap-1 ml-2">
            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- components/chat/__tests__/MessageBubble.test.tsx
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/chat/MessageBubble.tsx components/chat/__tests__/MessageBubble.test.tsx
git commit -m "feat: add MessageBubble component with streaming indicator"
```

---

## Task 12: UI Components — InputBar

**Files:**
- Create: `components/chat/InputBar.tsx`

- [ ] **Step 1: Write test**

Create `components/chat/__tests__/InputBar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputBar } from '../InputBar'

describe('InputBar', () => {
  it('calls onSend with message when submit clicked', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i)
    fireEvent.change(input, { target: { value: 'Merhaba!' } })
    fireEvent.click(screen.getByRole('button', { name: /إرسال|Send/i }))

    expect(onSend).toHaveBeenCalledWith('Merhaba!')
  })

  it('clears input after send', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /إرسال|Send/i }))

    expect(input.value).toBe('')
  })

  it('disables send when disabled prop is true', () => {
    render(<InputBar onSend={vi.fn()} disabled={true} />)
    expect(screen.getByRole('button', { name: /إرسال|Send/i })).toBeDisabled()
  })

  it('sends on Enter key press', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i)
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('test')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- components/chat/__tests__/InputBar.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Implement component**

Create `components/chat/InputBar.tsx`:

```typescript
'use client'

import { useState, KeyboardEvent } from 'react'

interface InputBarProps {
  onSend: (message: string) => void
  disabled: boolean
}

export function InputBar({ onSend, disabled }: InputBarProps) {
  const [value, setValue] = useState('')

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 p-3 border-t border-gray-200 bg-white">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="اكتب رسالتك... / Write your message..."
        disabled={disabled}
        className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="إرسال / Send"
        className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        إرسال
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- components/chat/__tests__/InputBar.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/chat/InputBar.tsx components/chat/__tests__/InputBar.test.tsx
git commit -m "feat: add InputBar component with Enter key support"
```

---

## Task 13: FeedbackPanel Component

**Files:**
- Create: `components/feedback/FeedbackPanel.tsx`, `components/feedback/ErrorCard.tsx`

- [ ] **Step 1: Create ErrorCard**

Create `components/feedback/ErrorCard.tsx`:

```typescript
'use client'

import type { FeedbackItem } from '@/lib/types'

const ICONS: Record<FeedbackItem['type'], string> = {
  correct: '✓',
  correction: '✏️',
  suggestion: '💡',
  new_vocab: '📖',
}

const COLORS: Record<FeedbackItem['type'], string> = {
  correct: 'bg-green-50 border-green-200 text-green-800',
  correction: 'bg-orange-50 border-orange-200 text-orange-800',
  suggestion: 'bg-blue-50 border-blue-200 text-blue-800',
  new_vocab: 'bg-purple-50 border-purple-200 text-purple-800',
}

interface ErrorCardProps {
  item: FeedbackItem
}

export function ErrorCard({ item }: ErrorCardProps) {
  return (
    <div className={`border rounded-lg p-2 text-xs ${COLORS[item.type]}`}>
      <div className="flex items-start gap-1.5">
        <span className="text-sm">{ICONS[item.type]}</span>
        <div>
          {item.original && item.correction && (
            <div className="mb-0.5">
              <span className="line-through opacity-60">{item.original}</span>
              <span className="mx-1">→</span>
              <span className="font-semibold">{item.correction}</span>
            </div>
          )}
          <p className="opacity-80">{item.explanation}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FeedbackPanel**

Create `components/feedback/FeedbackPanel.tsx`:

```typescript
'use client'

import type { FeedbackResponse, Session } from '@/lib/types'
import { ErrorCard } from './ErrorCard'

interface FeedbackPanelProps {
  feedback: FeedbackResponse | null
  session: Session | null
  goals: string[]
}

export function FeedbackPanel({ feedback, session, goals }: FeedbackPanelProps) {
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const currentLevelIndex = session ? CEFR_LEVELS.indexOf(session.cefr_level) : 0

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-y-auto">
      {/* XP + Streak */}
      {session && (
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span className="font-semibold text-indigo-600">⚡ {session.total_xp} XP</span>
          <span>🔥 {session.streak_days} {session.streak_days === 1 ? 'يوم' : 'أيام'}</span>
        </div>
      )}

      {/* CEFR Progress */}
      {session && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            {CEFR_LEVELS.map((level, i) => (
              <span
                key={level}
                className={`font-medium ${i === currentLevelIndex ? 'text-indigo-600' : ''}`}
              >
                {level}
              </span>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${((currentLevelIndex + 1) / CEFR_LEVELS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Goals */}
      {goals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">الأهداف</h3>
          <div className="flex flex-col gap-1">
            {goals.map((goal, i) => (
              <div key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                {goal}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">التغذية الراجعة</h3>
        {!feedback && (
          <p className="text-xs text-gray-400 text-center py-4">
            ابدأ المحادثة لرؤية التغذية الراجعة
          </p>
        )}
        {feedback && feedback.items.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 text-center">
            ✓ ممتاز! لا أخطاء في هذه الرسالة
          </div>
        )}
        {feedback && feedback.items.length > 0 && (
          <div className="flex flex-col gap-2">
            {feedback.items.map((item, i) => (
              <ErrorCard key={i} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/feedback/FeedbackPanel.tsx components/feedback/ErrorCard.tsx
git commit -m "feat: add FeedbackPanel and ErrorCard components"
```

---

## Task 14: Chat Page

**Files:**
- Modify: `app/chat/page.tsx`

- [ ] **Step 1: Create chat page**

Create `app/chat/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { InputBar } from '@/components/chat/InputBar'
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel'
import type { Language, CEFRLevel, FeedbackResponse, Session } from '@/lib/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPageProps {
  searchParams: { language?: string }
}

export default function ChatPage({ searchParams }: ChatPageProps) {
  const language = (searchParams.language ?? 'turkish') as Language
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [knownVocab, setKnownVocab] = useState<string[]>([])
  const [goals] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load session and vocab on mount
  useEffect(() => {
    async function init() {
      const [sessionRes, vocabRes] = await Promise.all([
        fetch(`/api/session?language=${language}`),
        fetch(`/api/vocab?language=${language}&known=true`),
      ])

      if (sessionRes.ok) setSession(await sessionRes.json())

      if (vocabRes.ok) {
        const vocab = await vocabRes.json()
        setKnownVocab(vocab.map((v: { word: string }) => v.word))
      }
    }
    init()
  }, [language])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!session) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setError(null)

    // Optimistic assistant bubble
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      // Start chat stream
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          language,
          session_id: session.id,
          cefr_level: session.cefr_level,
          known_vocab: knownVocab,
          goals,
          recent_errors: [],
          last_topic: null,
        }),
      })

      if (!chatRes.ok) throw new Error('فشل الاتصال بالمعلم')

      const reader = chatRes.body!.getReader()
      const decoder = new TextDecoder()
      let userMsgDbId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const data = JSON.parse(line.slice(6))

          if (data.text) {
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: m.content + data.text } : m)
            )
          }

          if (data.done && data.user_message_id) {
            userMsgDbId = data.user_message_id
          }
        }
      }

      // Trigger feedback analysis in parallel (fire and forget style)
      if (userMsgDbId) {
        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            language,
            message_id: userMsgDbId,
          }),
        }).then(r => r.json()).then(fb => {
          setFeedback(fb)
          // Update known vocab if new words were added
          if (fb.new_vocab?.length > 0) {
            setKnownVocab(prev => [...prev, ...fb.new_vocab.map((v: { word: string }) => v.word)])
          }
        }).catch(() => {
          // Feedback failure doesn't affect chat
        })
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [session, language, knownVocab, goals])

  const langLabel = language === 'turkish' ? '🇹🇷 التركية' : '🇬🇧 الإنجليزية'

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat Area */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <h1 className="text-sm font-semibold text-gray-800">{langLabel}</h1>
          <a href="/" className="text-xs text-gray-400 hover:text-gray-600">تغيير اللغة</a>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-8">
              <p className="text-2xl mb-2">👋</p>
              <p>ابدأ المحادثة مع معلمك!</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={isLoading && idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-3 flex justify-between items-center">
              <span>⚠️ {error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 font-bold"
              >
                ×
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <InputBar onSend={sendMessage} disabled={isLoading || !session} />
      </div>

      {/* Feedback Sidebar */}
      <div className="w-64 border-l bg-white flex-shrink-0 hidden md:flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">لوحة التعلم</h2>
        </div>
        <FeedbackPanel feedback={feedback} session={session} goals={goals} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat: add full chat page with streaming, feedback panel, and session management"
```

---

## Task 15: Landing Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Create landing page**

Replace contents of `app/page.tsx`:

```typescript
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مُعلِّم اللغات</h1>
        <p className="text-gray-500 mb-8 text-sm">تعلم التركية والإنجليزية مع ذكاء اصطناعي يتكيّف معك</p>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/chat?language=turkish"
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <span className="text-4xl">🇹🇷</span>
            <span className="font-semibold text-gray-800">اللغة التركية</span>
            <span className="text-xs text-gray-400">Türkçe</span>
          </Link>

          <Link
            href="/chat?language=english"
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <span className="text-4xl">🇬🇧</span>
            <span className="font-semibold text-gray-800">اللغة الإنجليزية</span>
            <span className="text-xs text-gray-400">English</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add language selection landing page"
```

---

## Task 16: End-to-End Verification

- [ ] **Step 1: Fill in .env.local with real values**

Open `.env.local` and replace all `REPLACE_ME` with real values from:
- OpenRouter: openrouter.ai → Keys
- Supabase: your project → Settings → API

- [ ] **Step 2: Run all tests**

```bash
npm run test:run
```

Expected: All tests PASS

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

Expected: `✓ Ready on http://localhost:3000`

- [ ] **Step 4: Test the full flow**

1. Open `http://localhost:3000`
2. Click "اللغة التركية"
3. Verify you reach `/chat?language=turkish`
4. Type "Merhaba" and press Enter
5. Verify: AI response streams word by word
6. Verify: Feedback panel updates within 3 seconds
7. Open Supabase Dashboard → Table Editor → `messages`
8. Verify: Both user and assistant messages are saved
9. Open `vocab_cards` table — verify new words were extracted

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete foundation — working chat with streaming AI, Supabase persistence, and feedback panel"
```

---

## What's Next

**Plan 2 — Learning Systems:**
- SRS algorithm (SM-2) + `/review` page
- CEFR auto-detection + level progression
- Input+1 vocabulary management
- Adaptive system prompt with full student context

**Plan 3 — Advanced Features:**
- Voice TTS + STT (Web Speech API)
- Structured lessons (`/lessons`)
- Dashboard with charts (`/dashboard`)
- Goals management (`/goals`)
- Gamification: XP, streaks, badges
- Anki export
