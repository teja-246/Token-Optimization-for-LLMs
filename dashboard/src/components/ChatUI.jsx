import React, { useState } from 'react';
import { Send, MessageSquare, Plus, Bot, User } from 'lucide-react';
import Analytics from './analytics';

export default function ChatUI() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! Aether Engine is ready. How can I assist you today?", sender: 'ai' }
  ]);

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const newUserMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');

    // Mock AI Response (Replace this with your Go API Gateway call later)
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "This is a mock response from the Aether routing layer.",
        sender: 'ai'
      }]);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* LEFT SIDEBAR: History */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <button className="flex items-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-sm font-medium py-2 px-3 rounded-md transition-colors border border-slate-700">
            <Plus size={16} /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500 px-2 pt-2 uppercase tracking-wider">Recent Sessions</p>
          
          {/* Mock History Items */}
          {['Debugging Docker loop', 'Optimize React context', 'Explain gRPC vs REST'].map((title, i) => (
            <button key={i} className="flex items-center gap-3 w-full text-left px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-md transition-colors group">
              <MessageSquare size={14} className="text-slate-500 group-hover:text-slate-300" />
              <span className="truncate">{title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Header */}
        <header className="h-14 flex items-center px-6 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm z-10 sticky top-0">
          <h2 className="text-sm font-semibold text-slate-200">Aether Playground</h2>
          <span className="ml-3 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Gateway Online
          </span>
          <span className='px-5'>< Analytics /></span>
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl mx-auto ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              {/* Avatar */}
              <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center border ${
                msg.sender === 'user' 
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={`px-4 py-3 rounded-lg text-sm leading-relaxed max-w-[85%] ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'bg-transparent text-slate-200'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Input Area */}
        <div className="p-4 bg-slate-950">
          <div className="max-w-3xl mx-auto relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Aether... (Shift+Enter for new line)"
              className="w-full bg-slate-800/50 border border-slate-700 text-slate-100 rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:border-slate-500 focus:bg-slate-800 transition-colors resize-none overflow-hidden min-h-13 max-h-48"
              rows="1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 transition-colors flex items-center justify-center"
            >
              <Send size={16} className={input.trim() ? 'translate-x-px translate-y-px' : ''} />
            </button>
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            We route your prompt to the optimal model. AI can make mistakes.
          </p>
        </div>

      </main>
    </div>
  );
}