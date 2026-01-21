"use client";

import { useState, useRef, useEffect } from "react";

const LANGUAGES = {
  auto: "Auto Detect",
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
};

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("ko");
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References for sync scrolling
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<boolean>(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Auto-detection logic
  useEffect(() => {
    if (sourceLang !== "auto" || !sourceText.trim() || sourceText.length < 3) {
      setDetectedLang(null);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/detect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sourceText }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.detected && LANGUAGES[data.detected as keyof typeof LANGUAGES]) {
            setDetectedLang(data.detected);
          }
        }
      } catch (err) {
        console.error("Detection failed:", err);
      }
    }, 600); // 600ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sourceText, sourceLang, API_URL]);

  // Smart Language Switching Logic
  useEffect(() => {
    // Current effective source language (either manual or detected)
    const effectiveSource = sourceLang === "auto" ? detectedLang : sourceLang;

    if (effectiveSource && effectiveSource === targetLang) {
      // If collision occurs
      if (effectiveSource === "ko") {
        setTargetLang("en"); // Default to English if source is Korean
      } else {
        setTargetLang("ko"); // Default to Korean for others
      }
    }
  }, [detectedLang, sourceLang, targetLang]);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    setError(null);
    setIsLoading(true);
    setTranslatedText("");
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_URL}/api/translate/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: sourceText,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to read response stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsStreaming(false);
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setTranslatedText((prev) => prev + parsed.text);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === "auto") return;

    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleClear = () => {
    setSourceText("");
    setTranslatedText("");
    setError(null);
  };

  const handleCopy = async () => {
    if (translatedText) {
      await navigator.clipboard.writeText(translatedText);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  /* Optimized Scroll Synchronization */
  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (isScrollingRef.current) return;

    const source = sourceRef.current;
    const target = targetRef.current;
    const eventTarget = e.target as HTMLElement;

    if (!source || !target) return;

    // Use requestAnimationFrame for smoother performance
    requestAnimationFrame(() => {
      isScrollingRef.current = true;

      // Calculate relative scroll position
      const percentage = eventTarget.scrollTop / (eventTarget.scrollHeight - eventTarget.clientHeight);

      if (eventTarget === source) {
        target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
      } else {
        source.scrollTop = percentage * (source.scrollHeight - source.clientHeight);
      }

      // shorter timeout might be sufficient with RAF, but keeping safety buffer
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 10);
    });
  };

  // Keyboard shortcut: Ctrl/Cmd + Enter to translate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        handleTranslate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sourceText, sourceLang, targetLang]);

  return (
    <div className="gradient-bg h-screen w-screen p-3 flex flex-col items-center justify-center overflow-hidden">
      {/* Application Frame */}
      <main className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex flex-col relative overflow-hidden ring-1 ring-black/5">

        {/* Header & Controls Area */}
        <div className="flex-none p-4 border-b border-white/10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-transparent bg-clip-text drop-shadow-sm">
                Orchid219
              </h1>
              <span className="text-xs text-slate-600 font-medium bg-white/60 px-2 py-1 rounded-full border border-white/40 shadow-sm backdrop-blur-sm">
                TranslateGemma 12B
              </span>
            </div>

            {/* Central Language Controls */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="lang-select min-w-[140px] bg-white/70 border-white/40 shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                >
                  {Object.entries(LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSwapLanguages}
                className="p-2 rounded-full hover:bg-white/50 active:scale-95 transition-all text-slate-600 hover:text-indigo-600 shadow-sm border border-transparent hover:border-white/40"
                disabled={sourceLang === "auto"}
                title="Swap languages"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" />
                </svg>
              </button>

              <div className="relative group">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="lang-select min-w-[140px] bg-white/70 border-white/40 shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                >
                  {Object.entries(LANGUAGES)
                    .filter(([code]) => {
                      if (code === "auto") return false;
                      // Filter out the detected language if source is Auto, or source language if manual
                      const effectiveSource = sourceLang === "auto" ? detectedLang : sourceLang;
                      return code !== effectiveSource;
                    })
                    .map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isLoading ? (
                <button onClick={handleStop} className="btn-primary bg-red-500 hover:bg-red-600 py-2 px-6 text-sm shadow-lg shadow-red-500/20">
                  <span className="flex items-center gap-2">
                    Stop
                    <div className="loading-dots scale-75">
                      <span></span><span></span><span></span>
                    </div>
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleTranslate}
                  className="btn-primary py-2 px-6 text-sm shadow-lg shadow-indigo-500/20"
                  disabled={!sourceText.trim()}
                >
                  Translate
                </button>
              )}
            </div>
          </header>

          {/* Error Message */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm animate-fade-in shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {error}
            </div>
          )}
        </div>

        {/* Main Content Area - Full Screen Split View */}
        <div className="flex-1 flex gap-px min-h-0 bg-slate-200/50">
          {/* Source Panel */}
          <div className="flex-1 flex flex-col bg-white/40 hover:bg-white/50 transition-colors relative group">
            <div className="flex justify-between items-center px-5 py-3 border-b border-black/5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                {sourceLang === "auto" ? (
                  <>
                    Auto
                    {detectedLang && (
                      <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {LANGUAGES[detectedLang as keyof typeof LANGUAGES]}
                      </span>
                    )}
                  </>
                ) : (
                  LANGUAGES[sourceLang as keyof typeof LANGUAGES]
                )}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400 font-mono">
                  {sourceText.length} chars
                </span>
                <button
                  onClick={handleClear}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              ref={sourceRef}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              onScroll={handleScroll}
              placeholder="Enter text to translate..."
              className="flex-1 w-full p-6 text-lg bg-transparent border-none resize-none focus:ring-0 focus:outline-none leading-relaxed text-slate-700 placeholder:text-slate-300 selection:bg-indigo-100"
              spellCheck="false"
            />
          </div>

          {/* Target Panel */}
          <div className="flex-1 flex flex-col bg-white/60 hover:bg-white/70 transition-colors relative group">
            <div className="flex justify-between items-center px-5 py-3 border-b border-black/5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {LANGUAGES[targetLang as keyof typeof LANGUAGES]}
              </span>
              <div className="flex items-center gap-3">
                {isStreaming && (
                  <span className="flex items-center gap-1.5 text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    STREAMING
                  </span>
                )}
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                  disabled={!translatedText}
                >
                  Copy
                </button>
              </div>
            </div>
            <div
              ref={targetRef}
              onScroll={handleScroll}
              className={`flex-1 w-full p-6 text-lg overflow-auto whitespace-pre-wrap leading-relaxed text-slate-800 ${isStreaming ? "streaming-text-active" : ""
                }`}
            >
              {translatedText || (
                <span className="text-slate-300/60 italic selection:bg-transparent">Translation will appear here...</span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
