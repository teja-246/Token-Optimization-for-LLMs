import React from 'react';

export default function ChatMessage({ message }) {
  const {
    role,
    content = '',
    loading = false,
    streaming = false,
    meta = null,
    events = [],
    error = null,
    correction = null, // In case parent tracks 'correction' phase text separately
  } = message;

  const isUser = role === 'user';

  // ── 1. User Message ────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="message-row user-row fadeSlideIn">
        <div className="bubble user-bubble">
          {content}
        </div>
      </div>
    );
  }

  // ── 2. Assistant Message ───────────────────────────────────────────────────
  return (
    <div className="message-row assistant-row fadeSlideIn">
      
      {/* A. Event Cards (Loop / Remediation) */}
      {events?.length > 0 && (
        <div className="message-events">
          {events.map((ev, i) => {
            if (ev.type === 'loop_detected') {
              return (
                <div key={i} className="event-card loop-card">
                  <div className="event-header">
                    <span className="icon">⚠️</span> 
                    <strong>Loop Detected</strong>
                    <span className="badge">Cycle Length: {ev.cycle_length}</span>
                  </div>
                  <div className="event-body">{ev.message}</div>
                </div>
              );
            }
            if (ev.type === 'remediation') {
              return (
                <div key={i} className="event-card remediation-card">
                  <div className="event-header">
                    <span className="icon">🔧</span>
                    <strong>Remediation Applied</strong>
                  </div>
                  <div className="event-body">
                    <p>{ev.diagnosis}</p>
                    <div className="model-switch">
                      Switched: <code>{ev.previous_model}</code> ➔ <code>{ev.new_model}</code>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* B. Main Bubble (Loading / Content / Streaming / Correction) */}
      <div className="bubble assistant-bubble">
        {loading && !content ? (
          <div className="thinking-indicator">
            <span className="dot bounce" style={{ animationDelay: '0s' }}>•</span>
            <span className="dot bounce" style={{ animationDelay: '0.15s' }}>•</span>
            <span className="dot bounce" style={{ animationDelay: '0.3s' }}>•</span>
          </div>
        ) : (
          <div className="content-wrapper">
            {/* Standard token stream */}
            <span className="text">{content}</span>
            
            {/* CoVe correction block (if handled separately by parent) */}
            {correction && (
              <span className="correction-text">
                {' '}{correction}
              </span>
            )}
            
            {/* Blinking cursor */}
            {streaming && <span className="cursor blink">▋</span>}
          </div>
        )}
      </div>

      {/* C. Error Block */}
      {error && (
        <div className="error-block">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* D. Metadata Footer (Renders only when complete) */}
      {!streaming && meta && (
        <div className="meta-tags">
          <span className="meta-tag">{meta.model}</span>
          
          <span className={`meta-tag cache-${meta.cache?.toLowerCase()}`}>
            {meta.cache}
          </span>
          
          <span className="meta-tag">{meta.latency_ms}ms</span>
          
          {meta.original_tokens !== undefined && meta.pruned_tokens !== undefined && (
            <span className="meta-tag">
              Tokens: {meta.pruned_tokens} / {meta.original_tokens}
            </span>
          )}
          
          {meta.cycle_detected && (
            <span className="meta-tag warning">Cycle Prevented</span>
          )}
        </div>
      )}
      
    </div>
  );
}