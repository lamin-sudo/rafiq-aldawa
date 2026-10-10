import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { ChevronRight, Send, Loader2, Bot, User, ShieldAlert, Trash2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { speakArabic, stopSpeaking, createSpeechRecognition, isSpeechRecognitionSupported, isSpeechSynthesisSupported } from "@/lib/voiceCommand";

const QUICK_KEYS = ["chatbot.quick1", "chatbot.quick2", "chatbot.quick3", "chatbot.quick4"];

export default function Chatbot() {
  const navigate = useNavigate();
  const t = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Voice (merged from the offline/PWA branch of the app)
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);

  const speechInSupported = isSpeechRecognitionSupported();
  const speechOutSupported = isSpeechSynthesisSupported();

  // Restore the saved conversation (last 50 messages)
  useEffect(() => {
    (async () => {
      try {
        const page = await api.entities.ChatMessage.filter({}, { sort: "created_date", limit: 50 });
        setMessages((page.items || []).map((m) => ({ id: m.id, role: m.role, content: m.content })));
      } catch (err) {
        console.error("Load chat error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, interimTranscript]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }
    };
  }, []);

  const persist = (msg) => {
    api.entities.ChatMessage.create({ role: msg.role, content: msg.content }).catch((e) => console.error("Persist chat error:", e));
  };

  const send = useCallback(
    async (text) => {
      const question = text || input;
      if (!question.trim() || sending) return;
      setInput("");
      setInterimTranscript("");
      const userMsg = { role: "user", content: question.trim() };
      setMessages((prev) => [...prev, userMsg]);
      persist(userMsg);
      setSending(true);
      try {
        const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
        const response = await api.functions.invoke("medicationAssistant", { question: question.trim(), history });
        const answer = response.data?.answer || t("chatbot.error");
        const botMsg = { role: "assistant", content: answer };
        setMessages((prev) => [...prev, botMsg]);
        persist(botMsg);
        if (autoSpeak) speakArabic(answer);
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [...prev, { role: "assistant", content: t("chatbot.error") }]);
      } finally {
        setSending(false);
      }
    },
    [input, sending, messages, t, autoSpeak]
  );

  const clearChat = async () => {
    setClearing(true);
    try {
      // RLS scopes this to the current user's own messages only
      await api.entities.ChatMessage.deleteMany({});
      setMessages([]);
      setConfirmClear(false);
    } catch (err) {
      console.error("Clear chat error:", err);
    } finally {
      setClearing(false);
    }
  };

  const toggleListening = () => {
    setVoiceError("");
    if (listening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      setListening(false);
      setInterimTranscript("");
      return;
    }
    const { recognition, isSupported } = createSpeechRecognition(
      (finalText, interim) => {
        if (interim) setInterimTranscript(interim);
        if (finalText) {
          setInterimTranscript("");
          send(finalText);
        }
      },
      (err) => {
        setVoiceError(t("chatbot.voiceError") || err);
        setListening(false);
      },
      () => setListening(false)
    );
    if (!isSupported || !recognition) {
      setVoiceError(t("chatbot.voiceError"));
      return;
    }
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceError(t("chatbot.voiceError"));
    }
  };

  const toggleSpeak = () => {
    if (autoSpeak) {
      stopSpeaking();
      setAutoSpeak(false);
      return;
    }
    setAutoSpeak(true);
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speakArabic(last.content);
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-8 py-4 border-b border-border shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors"
          aria-label={t("common.cancel")}
        >
          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-foreground">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-base text-foreground">{t("chatbot.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("chatbot.subtitle")}</p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {speechOutSupported && (
            <button
              onClick={toggleSpeak}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-colors",
                autoSpeak ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:bg-muted"
              )}
              aria-label={t("chatbot.readAloud")}
              title={t("chatbot.readAloud")}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors"
              aria-label={t("chatbot.clear")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Clear confirmation */}
      {confirmClear && (
        <div className="px-4 lg:px-8 py-3 border-b border-border bg-alert/10 shrink-0">
          <p className="text-sm text-foreground mb-2.5">{t("chatbot.clearConfirm")}</p>
          <div className="flex gap-2">
            <button
              onClick={clearChat}
              disabled={clearing}
              className="px-4 py-2 rounded-lg bg-alert text-alert-foreground text-sm font-medium hover:bg-alert/90 transition-colors disabled:opacity-50"
            >
              {t("chatbot.confirm")}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-4 py-2 rounded-lg border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              {t("chatbot.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 lg:px-8 py-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-accent/10 text-accent">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <p className="font-heading font-bold text-sm text-foreground mb-1">{t("chatbot.welcome")}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{t("chatbot.welcomeDesc")}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {QUICK_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => send(t(key))}
                  className="px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground hover:border-accent/40 hover:bg-accent/5 transition-colors text-start"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div className={cn("flex items-center justify-center w-8 h-8 rounded-full shrink-0", msg.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground")}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn("max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed", msg.role === "user" ? "bg-secondary text-secondary-foreground rounded-tr-sm" : "bg-card border border-border text-foreground rounded-tl-sm")}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && speechOutSupported && (
                <button
                  onClick={() => speakArabic(msg.content)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
                  aria-label={t("chatbot.readAloud")}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {t("chatbot.readAloud")}
                </button>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent text-accent-foreground shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-tl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions (when a conversation exists) */}
      {!loading && messages.length > 0 && (
        <div className="px-4 lg:px-8 pb-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {QUICK_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => send(t(key))}
                disabled={sending}
                className="shrink-0 px-3 py-1.5 rounded-full bg-card border border-border text-xs text-foreground hover:border-accent/40 hover:bg-accent/5 transition-colors disabled:opacity-50"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div className="px-4 lg:px-8 pb-1 shrink-0">
          <p className="text-xs text-alert">{voiceError}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 lg:px-8 py-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          {t("chatbot.disclaimer")}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 lg:px-8 pb-4 shrink-0">
        {listening && (
          <div className="mb-2 flex items-center gap-2 text-xs text-accent">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
            {interimTranscript || t("chatbot.listening")}
          </div>
        )}
        <div className="flex items-center gap-2">
          {speechInSupported && (
            <button
              onClick={toggleListening}
              disabled={sending}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl border-2 transition-colors disabled:opacity-50 shrink-0",
                listening ? "border-alert bg-alert/10 text-alert" : "border-border text-muted-foreground hover:bg-muted"
              )}
              aria-label={t("chatbot.voiceInput")}
              title={t("chatbot.voiceInput")}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("chatbot.placeholder")}
            className="h-12 flex-1"
            disabled={sending}
            aria-label={t("chatbot.placeholder")}
          />
          <button
            onClick={() => send()}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-accent-foreground disabled:opacity-50 hover:bg-accent/90 transition-colors touch-target shrink-0"
            aria-label={t("chatbot.title")}
          >
            <Send className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
