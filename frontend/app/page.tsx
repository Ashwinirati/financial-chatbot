'use client';

import React, { useEffect, useRef, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time?: string;
  sources?: string[];
};

type ChatSession = {
  id: string;
  createdAt: string;
  messages: Message[];
};

const STORAGE_SESSIONS_KEY = 'finchat_sessions_v1';

function nowIso() {
  return new Date().toISOString();
}

export default function Home() {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load sessions from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
    if (raw) {
      const loaded = JSON.parse(raw) as ChatSession[];
      setSessions(loaded);
      if (loaded.length > 0) setCurrentSessionId(loaded[0].id);
    }
  }, []);

  // Persist sessions to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [sessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Start a new session
  function startNewSession() {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      createdAt: nowIso(),
      messages: [],
    };
    setSessions(prevSessions => [newSession, ...prevSessions]);
    setCurrentSessionId(newSession.id);
  }

  // Add message to current session
  function addMessage(msg: Message) {
    setSessions(prevSessions =>
      prevSessions.map(s =>
        s.id === currentSessionId ? { ...s, messages: [...s.messages, msg] } : s
      )
    );
  }

  // Delete single chat session
  function deleteSession(sessionId: string) {
    setSessions(prevSessions => prevSessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(sessions[0]?.id || null);
    }
  }

  // Send message to backend
  async function sendMessage() {
    const text = input.trim();
    if (!text || !currentSessionId) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text, time: nowIso() };
    addMessage(userMsg);
    setInput('');
    setLoading(true);

    const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', text: '', time: nowIso() };
    addMessage(botMsg);

    try {
      const res = await fetch(`${backend}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const answer = data.answer || '';
      const sources = data.sources || [];

      // Typing animation
      let displayed = '';
      for (let i = 0; i < answer.length; i++) {
        displayed += answer[i];
        setSessions(prevSessions =>
          prevSessions.map(s =>
            s.id === currentSessionId
              ? {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === botMsg.id ? { ...m, text: displayed } : m
                  ),
                }
              : s
          )
        );
        await new Promise(r => setTimeout(r, 15));
      }

      // Final message with sources
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === currentSessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === botMsg.id ? { ...m, text: answer, sources } : m
                ),
              }
            : s
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSessions(prevSessions =>
        prevSessions.map(s =>
          s.id === currentSessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === botMsg.id
                    ? { ...m, text: `⚠️ Error: ${message}`, sources: [] }
                    : m
                ),
              }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) sendMessage();
    }
  }

  function clearAllSessions() {
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem(STORAGE_SESSIONS_KEY);
  }

  return (
    <main className="min-h-screen bg-green-50 py-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 px-4">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white rounded-2xl shadow-lg p-4 flex flex-col gap-2">
          <h2 className="text-xl font-bold mb-2 text-center">Chats</h2>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-green-700 transition"
            onClick={startNewSession}
          >
            + New Chat
          </button>
          <button
            className="text-red-500 underline mt-2"
            onClick={clearAllSessions}
          >
            Clear All
          </button>

          <div className="mt-4 flex-1 overflow-y-auto space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex justify-between items-center p-2 rounded-xl cursor-pointer hover:bg-green-50 bg-white">
                <div
                  className={s.id === currentSessionId ? 'font-semibold' : ''}
                  onClick={() => setCurrentSessionId(s.id)}
                >
                  {new Date(s.createdAt).toLocaleString()}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className="text-red-500 text-xs font-bold px-1 rounded hover:bg-red-100"
                  title="Delete this session"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-lg h-[95vh] overflow-hidden p-10">
          <h1 className="text-2xl font-bold mb-4 text-center">💬 Financial Chatbot</h1>
          <span className="text-gray-500 text-center">Click on ‘+New Chat’ to initiate a conversation.</span>

          <div className="flex-1 overflow-y-auto space-y-6">
            {currentSession?.messages.length === 0 && (
              <div className="text-center text-gray-400 italic py-10">
                Ask me about banking terms, loans, or fraud alerts. <br />
              </div>
            )}

            {currentSession?.messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-8 py-6 rounded-3xl max-w-[75%] shadow-md break-words ${
                    m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text || (m.role === 'bot' && loading ? '⏳ Typing...' : '')}</div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Sources:{' '}
                      {m.sources.map((s, i) => (
                        <a key={i} href={s} target="_blank" rel="noreferrer" className="underline mr-2">
                          {s}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <div className="mt-4 border-t pt-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <textarea
                className="flex-1 border rounded-2xl p-4 resize-none h-16"
                placeholder="Type your question (Enter to send, Shift+Enter for newline)..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-2xl font-semibold shadow-md disabled:opacity-50 transition-all"
                onClick={() => !loading && sendMessage()}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
              <div>
                Responses are informational only.
                <br />Click on ‘New Chat’ to initiate a conversation.
              </div>
            </div>
            <br />
          </div>
        </div>
      </div>
    </main>
  );
}
