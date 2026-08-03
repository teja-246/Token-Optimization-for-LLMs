// storage.js — conversation history persisted to localStorage
//
// ── Data shape ────────────────────────────────────────────────────────────────
//
//   conversations: [
//     {
//       id:        "uuid"      ← also the sessionId sent to the backend
//       title:     "string"    ← first 45 chars of the first user message
//       createdAt: "ISO"
//       updatedAt: "ISO"
//       messages: [
//         {
//           id:         "uuid"
//           role:       "user" | "assistant"
//           content:    "string"
//           correction: "string"
//           events:     []
//           meta:       null | { model, cache, ... }
//           error:      null | "string"
//           createdAt:  "ISO"
//         }
//       ]
//     }
//   ]

const KEY         = 'aether_conversations'
const MAX_CONVOS  = 50
const TITLE_LEN   = 45

// ── Read ──────────────────────────────────────────────────────────────────────

export function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch (_) {
    return []
  }
}

export function loadConversation(id) {
  return loadConversations().find(c => c.id === id) ?? null
}

// ── Write ─────────────────────────────────────────────────────────────────────

function save(convos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(convos.slice(0, MAX_CONVOS)))
  } catch (_) {
    // quota exceeded — fail silently, never crash the UI
  }
}

// Create a blank conversation entry.
// Called when the user clicks "New Chat" so the sidebar title appears
// even before the first message is sent.
export function createConversation(id) {
  const now = new Date().toISOString()
  const convo = { id, title: 'New Chat', createdAt: now, updatedAt: now, messages: [] }
  save([convo, ...loadConversations()])
  return convo
}

// Append a message to a conversation and persist.
// Generates the title from the first user message automatically.
// Moves the conversation to the top of the list (most-recent-first).
export function appendMessage(conversationId, message) {
  const convos = loadConversations()
  const idx    = convos.findIndex(c => c.id === conversationId)

  const full = {
    id:         crypto.randomUUID(),
    role:       message.role,
    content:    message.content    ?? '',
    correction: message.correction ?? '',
    events:     message.events     ?? [],
    meta:       message.meta       ?? null,
    error:      message.error      ?? null,
    createdAt:  new Date().toISOString(),
  }

  if (idx === -1) {
    const now = new Date().toISOString()
    save([{ id: conversationId, title: mkTitle(message),
            createdAt: now, updatedAt: now, messages: [full] },
          ...convos])
  } else {
    const c = { ...convos[idx] }
    c.messages  = [...c.messages, full]
    c.updatedAt = new Date().toISOString()
    if (c.title === 'New Chat' && message.role === 'user') c.title = mkTitle(message)
    convos.splice(idx, 1)
    save([c, ...convos])
  }

  return full
}

export function deleteConversation(id) {
  save(loadConversations().filter(c => c.id !== id))
}

export function clearAll() {
  localStorage.removeItem(KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkTitle(message) {
  const t = (message.content ?? '').trim()
  if (!t) return 'New Chat'
  return t.length > TITLE_LEN ? t.slice(0, TITLE_LEN) + '…' : t
}