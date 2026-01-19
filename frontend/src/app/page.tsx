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
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    <main className="gradient-bg min-h-screen relative">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
              Orchid219
            </span>
          </h1>
          <p className="text-slate-500 text-sm">
            Private & Offline Translation • Powered by TranslateGemma 12B
          </p>
        </header>

        {/* Language Selector */}
        <div className="flex items-center justify-center gap-4 mb-6 animate-fade-in">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="lang-select min-w-[160px]"
          >
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSwapLanguages}
            className="swap-btn"
            disabled={sourceLang === "auto"}
            title="Swap languages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="lang-select min-w-[160px]"
          >
            {Object.entries(LANGUAGES)
              .filter(([code]) => code !== "auto")
              .map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
          </select>
        </div>

        {/* Translation Panels */}
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {/* Source Panel */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-slate-500">
                {LANGUAGES[sourceLang as keyof typeof LANGUAGES]}
              </span>
              <button
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Enter text to translate..."
              className="translation-input w-full h-64 p-4"
            />
            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-slate-400">
                {sourceText.length} characters
              </span>
              <span className="text-xs text-slate-400">
                ⌘ + Enter to translate
              </span>
            </div>
          </div>

          {/* Target Panel */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-slate-500">
                {LANGUAGES[targetLang as keyof typeof LANGUAGES]}
              </span>
              <button
                onClick={handleCopy}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                disabled={!translatedText}
              >
                Copy
              </button>
            </div>
            <div
              className={`translation-input w-full h-64 p-4 overflow-auto whitespace-pre-wrap ${isStreaming ? "streaming-text" : ""
                }`}
            >
              {translatedText || (
                <span className="text-slate-400">Translation will appear here...</span>
              )}
            </div>
            <div className="flex justify-between items-center mt-4">
              <span className="text-xs text-slate-400">
                {translatedText.length} characters
              </span>
              {isStreaming && (
                <span className="text-xs text-indigo-400">Streaming...</span>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-fade-in">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-8 animate-fade-in">
          {isLoading ? (
            <button onClick={handleStop} className="btn-primary bg-red-500">
              <span className="flex items-center gap-2">
                Stop
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </span>
            </button>
          ) : (
            <button
              onClick={handleTranslate}
              className="btn-primary"
              disabled={!sourceText.trim()}
            >
              Translate
            </button>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-slate-500">
          <p>🔒 All translations run locally on your device</p>
          <p className="mt-1">No data leaves your computer</p>
        </footer>
      </div>
    </main>
  );
}
