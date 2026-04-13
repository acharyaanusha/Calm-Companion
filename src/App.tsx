import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;
type WindowWithSpeech = Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

type BreathPhase = "inhale" | "hold-in" | "exhale" | "hold-out" | "idle";

const BREATH_SEQUENCE: { phase: BreathPhase; label: string; duration: number }[] = [
  { phase: "inhale", label: "Breathe in... 1, 2, 3, 4", duration: 4000 },
  { phase: "hold-in", label: "Hold... 1, 2, 3, 4", duration: 4000 },
  { phase: "exhale", label: "Breathe out... 1, 2, 3, 4, 5, 6", duration: 6000 },
  { phase: "hold-out", label: "Hold... 1, 2", duration: 2000 },
];

const GREETING = "Hi, I'm here with you. Whatever you're carrying right now — you don't have to carry it alone. What are you feeling?";

function BreathOrb() {
  const [phase, setPhase] = useState<BreathPhase>("idle");
  const [label, setLabel] = useState("Tap to breathe with me");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseIndexRef = useRef(0);

  const runNextPhase = useCallback(() => {
    const idx = phaseIndexRef.current % BREATH_SEQUENCE.length;
    const { phase: p, label: l, duration } = BREATH_SEQUENCE[idx];
    setPhase(p);
    setLabel(l);
    phaseIndexRef.current = idx + 1;
    timerRef.current = setTimeout(runNextPhase, duration);
  }, []);

  const handleClick = useCallback(() => {
    if (phase !== "idle") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("idle");
      setLabel("Tap to breathe with me");
      phaseIndexRef.current = 0;
    } else {
      runNextPhase();
    }
  }, [phase, runNextPhase]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isActive = phase !== "idle";

  return (
    <div className="orb-container" onClick={handleClick} role="button" tabIndex={0} aria-label="Breathing guide">
      <div
        className={[
          "breath-orb",
          isActive ? "orb-active" : "",
          phase === "inhale" ? "orb-expand" : "",
          phase === "exhale" ? "orb-contract" : "",
          phase === "hold-in" ? "orb-hold-in" : "",
          phase === "hold-out" ? "orb-hold-out" : "",
        ].join(" ")}
      >
        <div className="orb-inner">
          <div className="orb-glow" />
          <div className="orb-core" />
          <div className="orb-shimmer" />
        </div>
      </div>
      <span className="breath-label">{label}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index}><em>{m[1]}</em></strong>);
    else if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`message-row ${isUser ? "message-user" : "message-assistant"}`}>
      {!isUser && <div className="avatar">✦</div>}
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
        {message.content.split("\n").map((line, i) => (
          <p key={i}>{line ? renderInline(line) : <>&nbsp;</>}</p>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOrb, setShowOrb] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const hasStarted = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: text,
      id: Date.now().toString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", id: assistantId },
    ]);

    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + data.text }
                      : m
                  )
                );
              }
            } catch { /* skip malformed */ }
          }
        }
      }

    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "I'm here with you, but I'm having trouble connecting right now. Take a slow breath, and try again in just a moment." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const win = window as WindowWithSpeech;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;

    if (!SR) {
      setInput("[Voice input isn't supported in this browser — try Chrome or Edge]");
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev.trim() ? prev.trim() + " " + transcript : transcript));
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {/* Animated background layers */}
      <div className="bg-layer bg-layer-1" />
      <div className="bg-layer bg-layer-2" />
      <div className="bg-layer bg-layer-3" />
      <div className="noise" />

      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">◎</span>
            <span className="logo-text">Calm</span>
          </div>
          <button
            className="orb-toggle"
            onClick={() => setShowOrb((p) => !p)}
          >
            {showOrb ? "Hide breath guide" : "Breathe with me"}
          </button>
        </div>
      </header>

      <main className="main">
        {!hasStarted && (
          <div className="welcome">
            <p className="welcome-eyebrow">You are safe here.</p>
            <h1 className="welcome-title">
              Whatever you're feeling —<br />
              <em>I'm listening.</em>
            </h1>
            <p className="welcome-body">
              Stressed about a goal? Spiraling after a setback? Overwhelmed and can't breathe?
              Talk it through here. No rushing, no toxic positivity — just a steady presence to help you find your footing again.
            </p>
            {/* Static greeting shown before conversation starts */}
            <div className="greeting-bubble">
              <div className="avatar">✦</div>
              <div className="bubble bubble-assistant">
                <p>{GREETING}</p>
              </div>
            </div>
          </div>
        )}

        {showOrb && (
          <div className={`orb-wrapper ${hasStarted ? "orb-compact" : ""}`}>
            <BreathOrb />
          </div>
        )}

        {hasStarted && (
          <div className="messages">
            {messages.map((msg) =>
              msg.content === "" && msg.role === "assistant" ? (
                <div key={msg.id} className="message-row message-assistant">
                  <div className="avatar">✦</div>
                  <div className="bubble bubble-assistant">
                    <TypingDots />
                  </div>
                </div>
              ) : (
                <MessageBubble key={msg.id} message={msg} />
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="input-row">
          <button
            className={`mic-btn ${isRecording ? "mic-active" : ""}`}
            onClick={toggleRecording}
            disabled={isLoading}
            aria-label={isRecording ? "Stop recording" : "Speak your message"}
          >
            {isRecording ? (
              <span className="mic-recording-dot" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            )}
          </button>
          <textarea
            ref={textareaRef}
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? "Listening..."
                : hasStarted
                ? "Keep going, I'm here..."
                : "What's going on? Share as much or as little as you need..."
            }
            rows={1}
            disabled={isLoading}
          />
          <button
            className={`send-btn ${isLoading ? "send-loading" : ""} ${!input.trim() || isLoading ? "send-disabled" : ""}`}
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
          >
            {isLoading ? (
              <span className="spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </button>
        </div>
        <p className="footer-hint">
          <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line · tap mic to speak
        </p>
      </footer>
    </div>
  );
}
