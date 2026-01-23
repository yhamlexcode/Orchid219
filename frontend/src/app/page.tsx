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

import Sidebar from "@/components/Sidebar";
import HistorySidebar from "@/components/HistorySidebar";
import AiDebateInterface from "@/components/AiDebateInterface";

export default function Home() {
  const [activeTab, setActiveTab] = useState("gemma");
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

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; reasoning?: string }[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null);

  // Llama 3.3 Chat State
  const [llamaInput, setLlamaInput] = useState("");
  const [llamaMessages, setLlamaMessages] = useState<{ role: string; content: string }[]>([]);
  const [isLlamaStreaming, setIsLlamaStreaming] = useState(false);
  const [llamaError, setLlamaError] = useState<string | null>(null);
  const llamaEndRef = useRef<HTMLDivElement>(null);

  // ExaOne Chat State
  const [exaoneInput, setExaoneInput] = useState("");
  const [exaoneMessages, setExaoneMessages] = useState<{ role: string; content: string }[]>([]);
  const [isExaoneStreaming, setIsExaoneStreaming] = useState(false);
  const [exaoneError, setExaoneError] = useState<string | null>(null);

  const exaoneEndRef = useRef<HTMLDivElement>(null);

  // Debate Messages State (for loading history)
  const [debateMessages, setDebateMessages] = useState<any[]>([]);

  // Document Attachment State (DeepQwen)
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [documentContext, setDocumentContext] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document Attachment State (Llama)
  const [llamaAttachedFile, setLlamaAttachedFile] = useState<File | null>(null);
  const [llamaDocumentContext, setLlamaDocumentContext] = useState<string>("");
  const [isLlamaUploading, setIsLlamaUploading] = useState(false);
  const [llamaUploadError, setLlamaUploadError] = useState<string | null>(null);
  const llamaFileInputRef = useRef<HTMLInputElement>(null);

  // Document Attachment State (ExaOne)
  const [exaoneAttachedFile, setExaoneAttachedFile] = useState<File | null>(null);
  const [exaoneDocumentContext, setExaoneDocumentContext] = useState<string>("");
  const [isExaoneUploading, setIsExaoneUploading] = useState(false);
  const [exaoneUploadError, setExaoneUploadError] = useState<string | null>(null);
  const exaoneFileInputRef = useRef<HTMLInputElement>(null);

  // --- Chat History State ---
  const [gemmaSessionId, setGemmaSessionId] = useState<string | null>(null);
  const [deepqwenSessionId, setDeepqwenSessionId] = useState<string | null>(null);
  const [llamaSessionId, setLlamaSessionId] = useState<string | null>(null);
  const [exaoneSessionId, setExaoneSessionId] = useState<string | null>(null);
  const [debateSessionId, setDebateSessionId] = useState<string | null>(null); // New Debate Session State
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  // --- History Helper Functions ---
  const refreshHistory = () => setHistoryRefreshTrigger(prev => prev + 1);

  const loadSession = async (sessionId: string, modelType: string) => {
    try {
      const res = await fetch(`${API_URL}/api/history/session/${sessionId}`);
      if (!res.ok) return;

      const data = await res.json();
      const messages = data.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        reasoning: m.reasoning
      }));

      // Find the last message with attached file context (if any)
      const lastMessageWithFile = [...data.messages].reverse().find(
        (m: any) => m.attached_file_context && m.attached_file_name
      );

      // Update state based on model
      if (modelType === 'deepqwen') {
        setDeepqwenSessionId(sessionId);
        setChatMessages(messages);
        // Restore document context if available
        if (lastMessageWithFile) {
          setDocumentContext(lastMessageWithFile.attached_file_context);
          // Create a pseudo File object for display (actual file not available)
          setAttachedFile({ name: lastMessageWithFile.attached_file_name } as File);
        } else {
          setDocumentContext("");
          setAttachedFile(null);
        }
      } else if (modelType === 'llama') {
        setLlamaSessionId(sessionId);
        setLlamaMessages(messages);
        if (lastMessageWithFile) {
          setLlamaDocumentContext(lastMessageWithFile.attached_file_context);
          setLlamaAttachedFile({ name: lastMessageWithFile.attached_file_name } as File);
        } else {
          setLlamaDocumentContext("");
          setLlamaAttachedFile(null);
        }
      } else if (modelType === 'exaone') {
        setExaoneSessionId(sessionId);
        setExaoneMessages(messages);
        if (lastMessageWithFile) {
          setExaoneDocumentContext(lastMessageWithFile.attached_file_context);
          setExaoneAttachedFile({ name: lastMessageWithFile.attached_file_name } as File);
        } else {
          setExaoneDocumentContext("");
          setExaoneAttachedFile(null);
        }
      } else if (modelType === 'gemma') {
        setGemmaSessionId(sessionId);
        // Gemma currently uses translate mode, but if we add chat mode later:
        // setGemmaMessages(messages); 
      } else if (modelType === 'debate') {
        setDebateSessionId(sessionId);
        setDebateMessages(messages);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const createNewChat = (modelType: string) => {
    if (modelType === 'deepqwen') {
      setDeepqwenSessionId(null);
      setChatMessages([]);
      setChatInput("");
    } else if (modelType === 'llama') {
      setLlamaSessionId(null);
      setLlamaMessages([]);
      setLlamaInput("");
    } else if (modelType === 'exaone') {
      setExaoneSessionId(null);
      setExaoneMessages([]);
      setExaoneInput("");
    } else if (modelType === 'gemma') {
      setGemmaSessionId(null);
      setSourceText("");

      setTranslatedText("");
    } else if (modelType === 'debate') {
      setDebateSessionId(null);
      setDebateMessages([]);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (sessionId === deepqwenSessionId) createNewChat('deepqwen');
    if (sessionId === llamaSessionId) createNewChat('llama');
    if (sessionId === exaoneSessionId) createNewChat('exaone');

    if (sessionId === gemmaSessionId) createNewChat('gemma');
    if (sessionId === debateSessionId) createNewChat('debate');
  };

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
      setIsChatStreaming(false);
      setIsLlamaStreaming(false);
    }
  };

  /* File Upload Handlers */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setAttachedFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "파일 업로드 실패");
      }

      const data = await response.json();
      setDocumentContext(data.content);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "업로드 중 오류 발생");
      setAttachedFile(null);
      setDocumentContext("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileRemove = () => {
    setAttachedFile(null);
    setDocumentContext("");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* Chat Handler */
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatStreaming) return;

    const userMessage = { role: "user", content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setIsChatStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      // Add placeholder for AI response
      setChatMessages((prev) => [...prev, { role: "assistant", content: "", reasoning: "" }]);

      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].map(({ role, content }) => ({ role, content })),
          model: "deepseek-r1:32b",
          document_context: documentContext || undefined,
          session_id: deepqwenSessionId || undefined
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");

      let rawContent = "";
      let reasoning = "";
      let finalContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsChatStreaming(false);
              refreshHistory(); // Refresh history list after chat ends
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              // Handle Session ID from backend
              if (parsed.session_id) {
                setDeepqwenSessionId(parsed.session_id);
                refreshHistory();
                continue;
              }
              if (parsed.content) {
                rawContent += parsed.content;

                // Simple Parsing Logic for <think>
                // This is a naive client-side parser that handles streaming
                if (rawContent.includes("<think>")) {
                  if (rawContent.includes("</think>")) {
                    const parts = rawContent.split("</think>");
                    reasoning = parts[0].replace("<think>", "");
                    finalContent = parts[1];
                  } else {
                    reasoning = rawContent.replace("<think>", "");
                    finalContent = ""; // Still thinking
                  }
                } else {
                  finalContent = rawContent;
                }

                setChatMessages((prev) => {
                  const newHistory = [...prev];
                  const lastMsg = newHistory[newHistory.length - 1];
                  lastMsg.content = finalContent;
                  lastMsg.reasoning = reasoning;
                  return newHistory;
                });
              }
            } catch { }
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatStreaming(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatStreaming]);

  /* Llama 3.3 Chat Handler */
  const handleLlamaSubmit = async () => {
    if (!llamaInput.trim() || isLlamaStreaming) return;

    const userMessage = { role: "user", content: llamaInput };
    setLlamaMessages((prev) => [...prev, userMessage]);
    setLlamaInput("");
    setIsLlamaStreaming(true);
    setLlamaError(null);

    abortControllerRef.current = new AbortController();

    try {
      // Add placeholder for AI response
      setLlamaMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...llamaMessages, userMessage].map(({ role, content }) => ({ role, content })),
          model: "llama3.3:70b-instruct-q3_K_M",
          document_context: llamaDocumentContext || undefined,
          session_id: llamaSessionId || undefined
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");

      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsLlamaStreaming(false);
              refreshHistory();
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.session_id) {
                setLlamaSessionId(parsed.session_id);
                refreshHistory();
                continue;
              }
              if (parsed.content) {
                content += parsed.content;
                setLlamaMessages((prev) => {
                  const newHistory = [...prev];
                  const lastMsg = newHistory[newHistory.length - 1];
                  lastMsg.content = content;
                  return newHistory;
                });
              }
            } catch { }
          }
        }
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.name !== "AbortError") {
        setLlamaError(err.message);
        // Remove the empty assistant message if it exists and is empty
        setLlamaMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
      }
    } finally {
      setIsLlamaStreaming(false);
    }
  };

  useEffect(() => {
    llamaEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [llamaMessages, isLlamaStreaming]);

  /* ExaOne Chat Handler */
  const handleExaoneSubmit = async () => {
    if (!exaoneInput.trim() || isExaoneStreaming) return;

    const userMessage = { role: "user", content: exaoneInput };
    setExaoneMessages((prev) => [...prev, userMessage]);
    setExaoneInput("");
    setIsExaoneStreaming(true);
    setExaoneError(null);

    abortControllerRef.current = new AbortController();

    try {
      // Add placeholder
      setExaoneMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...exaoneMessages, userMessage].map(({ role, content }) => ({ role, content })),
          // Use the clean alias we will create
          model: "exaone4.0:32b",
          document_context: exaoneDocumentContext || undefined,
          session_id: exaoneSessionId || undefined
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat failed: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader");

      let content = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              setIsExaoneStreaming(false);
              refreshHistory();
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.session_id) {
                setExaoneSessionId(parsed.session_id);
                refreshHistory();
                continue;
              }
              if (parsed.content) {
                content += parsed.content;
                setExaoneMessages((prev) => {
                  const newHistory = [...prev];
                  const lastMsg = newHistory[newHistory.length - 1];
                  lastMsg.content = content;
                  return newHistory;
                });
              }
            } catch { }
          }
        }
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.name !== "AbortError") {
        setExaoneError(err.message);
        setExaoneMessages(prev => prev.slice(0, -1)); // Remove empty message on error
      }
    } finally {
      setIsExaoneStreaming(false);
    }
  };

  useEffect(() => {
    exaoneEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exaoneMessages, isExaoneStreaming]);


  /* Llama File Upload Handlers */
  const handleLlamaFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLlamaFile(file);
  };

  const uploadLlamaFile = async (file: File) => {
    setLlamaUploadError(null);
    setIsLlamaUploading(true);
    setLlamaAttachedFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "파일 업로드 실패");
      }

      const data = await response.json();
      setLlamaDocumentContext(data.content);
    } catch (err) {
      setLlamaUploadError(err instanceof Error ? err.message : "업로드 중 오류 발생");
      setLlamaAttachedFile(null);
      setLlamaDocumentContext("");
    } finally {
      setIsLlamaUploading(false);
    }
  };

  const handleLlamaFileRemove = () => {
    setLlamaAttachedFile(null);
    setLlamaDocumentContext("");
    setLlamaUploadError(null);
    if (llamaFileInputRef.current) {
      llamaFileInputRef.current.value = "";
    }
  };

  /* ExaOne File Upload Handlers */
  const handleExaoneFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadExaoneFile(file);
  };

  const uploadExaoneFile = async (file: File) => {
    setExaoneUploadError(null);
    setIsExaoneUploading(true);
    setExaoneAttachedFile(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "파일 업로드 실패");
      }

      const data = await response.json();
      setExaoneDocumentContext(data.content);
    } catch (err) {
      setExaoneUploadError(err instanceof Error ? err.message : "업로드 중 오류 발생");
      setExaoneAttachedFile(null);
      setExaoneDocumentContext("");
    } finally {
      setIsExaoneUploading(false);
    }
  };

  const handleExaoneFileRemove = () => {
    setExaoneAttachedFile(null);
    setExaoneDocumentContext("");
    setExaoneUploadError(null);
    if (exaoneFileInputRef.current) {
      exaoneFileInputRef.current.value = "";
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
    <div className="gradient-bg h-screen w-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar activeId={activeTab} onSelect={setActiveTab} />

      {/* content-area */}
      <div className="flex-1 p-3 flex flex-col items-center justify-center overflow-hidden">
        {activeTab === "gemma" ? (
          /* Application Frame */
          <main className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex overflow-hidden relative ring-1 ring-black/5 animate-fade-in-up">
            <HistorySidebar
              modelType="gemma"
              currentSessionId={gemmaSessionId}
              onSelectSession={(id) => loadSession(id, 'gemma')}
              onNewChat={() => createNewChat('gemma')}
              onDeleteSession={handleDeleteSession}
              refreshTrigger={historyRefreshTrigger}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

              {/* Header & Controls Area */}
              <div className="flex-none p-4 border-b border-white/10">
                <header className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold text-orange-600 drop-shadow-sm">
                      TranslateGemma 12B
                    </h1>
                    <p className="text-xs text-stone-500">
                      🌐 Google 번역 특화 모델 · 고품질 다국어 번역 · 8K 토큰
                    </p>
                  </div>

                  {/* Central Language Controls */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <select
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="lang-select min-w-[140px] bg-white/70 border-white/40 shadow-sm focus:ring-2 focus:ring-orange-200"
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
                      className="p-2 rounded-full hover:bg-white/50 active:scale-95 transition-all text-stone-500 hover:text-orange-500 shadow-sm border border-transparent hover:border-white/40"
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
                        className="lang-select min-w-[140px] bg-white/70 border-white/40 shadow-sm focus:ring-2 focus:ring-orange-200"
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
                        className="btn-primary py-2 px-6 text-sm shadow-lg shadow-orange-500/20"
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
              <div className="flex-1 flex gap-px min-h-0 bg-stone-200/50">
                {/* Source Panel */}
                <div className="flex-1 flex flex-col bg-white/40 hover:bg-white/50 transition-colors relative group">
                  <div className="flex justify-between items-center px-5 py-3 border-b border-black/5">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                      {sourceLang === "auto" ? (
                        <>
                          Auto
                          {detectedLang && (
                            <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                              {LANGUAGES[detectedLang as keyof typeof LANGUAGES]}
                            </span>
                          )}
                        </>
                      ) : (
                        LANGUAGES[sourceLang as keyof typeof LANGUAGES]
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-stone-400 font-mono">
                        {sourceText.length} chars
                      </span>
                      <button
                        onClick={handleClear}
                        className="text-xs text-stone-400 hover:text-red-500 transition-colors flex items-center gap-1"
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
                    className="flex-1 w-full p-6 text-lg bg-transparent border-none resize-none focus:ring-0 focus:outline-none leading-relaxed text-stone-700 placeholder:text-stone-300 selection:bg-orange-100"
                    spellCheck="false"
                  />
                </div>

                {/* Target Panel */}
                <div className="flex-1 flex flex-col bg-white/60 hover:bg-white/70 transition-colors relative group">
                  <div className="flex justify-between items-center px-5 py-3 border-b border-black/5">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                      {LANGUAGES[targetLang as keyof typeof LANGUAGES]}
                    </span>
                    <div className="flex items-center gap-3">
                      {isStreaming && (
                        <span className="flex items-center gap-1.5 text-[10px] text-orange-500 font-bold bg-orange-50 px-2 py-0.5 rounded-full animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                          STREAMING
                        </span>
                      )}
                      <button
                        onClick={handleCopy}
                        className="text-xs text-stone-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                        disabled={!translatedText}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div
                    ref={targetRef}
                    onScroll={handleScroll}
                    className={`flex-1 w-full p-6 text-lg overflow-auto whitespace-pre-wrap leading-relaxed text-stone-800 ${isStreaming ? "streaming-text-active" : ""
                      }`}
                  >
                    {translatedText || (
                      <span className="text-stone-300/60 italic selection:bg-transparent">Translation will appear here...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        ) : activeTab === "exaone" ? (
          /* ExaOne Chat Interface */
          <main className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex overflow-hidden relative ring-1 ring-black/5 animate-fade-in-up">
            <HistorySidebar
              modelType="exaone"
              currentSessionId={exaoneSessionId}
              onSelectSession={(id) => loadSession(id, 'exaone')}
              onNewChat={() => createNewChat('exaone')}
              onDeleteSession={handleDeleteSession}
              refreshTrigger={historyRefreshTrigger}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              <div className="flex-none p-4 border-b border-white/10">
                <header className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold text-orange-600 drop-shadow-sm">ExaOne 4.0 (32B)</h1>
                    <p className="text-xs text-stone-500">
                      🇰🇷 대한민국 하이브리드 AI · 전문 지식 · 32B 전문가 모델
                    </p>
                  </div>
                </header>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {exaoneMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
                      <span className="text-2xl font-bold text-orange-500">E</span>
                    </div>
                    <p className="text-lg font-medium">LGAI ExaOne 4.0 - 무엇이든 물어보세요.</p>
                  </div>
                )}

                {exaoneMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`${msg.role === "user" ? "max-w-[80%] bg-orange-400 text-white rounded-2xl rounded-tr-sm" : "w-full max-w-[90%] bg-white border border-stone-100 rounded-2xl rounded-tl-sm"} shadow-sm p-4`}>
                      <div className={`text-base leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-stone-800"}`}>
                        {msg.role === "assistant" && !msg.content ? (
                          <span className="animate-pulse">Thinking...</span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={exaoneEndRef} />

                {exaoneError && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                    <span className="font-bold">Error:</span> {exaoneError}
                  </div>
                )}
              </div>

              <div className="flex-none px-6 py-4 bg-white/60 border-t border-white/20">
                {/* Hidden File Input (ExaOne) */}
                <input
                  ref={exaoneFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleExaoneFileSelect}
                  className="hidden"
                />

                {/* Attached File Preview (ExaOne) */}
                {exaoneAttachedFile && (
                  <div className="mb-3 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm text-orange-700 font-medium truncate flex-1">{exaoneAttachedFile.name}</span>
                    {isExaoneUploading ? (
                      <span className="text-xs text-orange-500 animate-pulse">업로드 중...</span>
                    ) : (
                      <span className="text-xs text-green-600">✓ 첨부됨</span>
                    )}
                    <button
                      onClick={handleExaoneFileRemove}
                      className="p-1 hover:bg-orange-100 rounded text-orange-500 hover:text-red-500 transition-colors"
                      title="파일 제거"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                )}

                {exaoneUploadError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {exaoneUploadError}
                  </div>
                )}

                <div className="flex gap-2 max-w-4xl mx-auto">
                  {/* File Attachment Button */}
                  <button
                    onClick={() => exaoneFileInputRef.current?.click()}
                    className="bg-white/70 border border-white/40 p-3 rounded-xl hover:bg-orange-50 transition-colors shadow-inner"
                    title="문서 첨부 (PDF, TXT, DOCX)"
                    disabled={isExaoneStreaming}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                  </button>
                  <input
                    type="text"
                    value={exaoneInput}
                    onChange={(e) => setExaoneInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleExaoneSubmit()}
                    placeholder="ExaOne에게 메시지 보내기..."
                    className="flex-1 bg-white/70 border-white/40 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-200 shadow-inner"
                    disabled={isExaoneStreaming}
                  />
                  {isExaoneStreaming ? (
                    <button onClick={handleStop} className="bg-red-500 text-white p-3 rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">
                      Stop
                    </button>
                  ) : (
                    <button onClick={handleExaoneSubmit} className="bg-gradient-to-r from-orange-400 to-rose-400 text-white p-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    </button>
                  )}
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-slate-400">ExaOne can make mistakes. Check important info. {exaoneAttachedFile && "📎 문서 첨부됨"}</span>
                </div>
              </div>
            </div>
          </main>
        ) : activeTab === "deepqwen" ? (
          /* DeepQwen Chat Interface */
          <main className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex overflow-hidden relative ring-1 ring-black/5 animate-fade-in-up">
            <HistorySidebar
              modelType="deepqwen"
              currentSessionId={deepqwenSessionId}
              onSelectSession={(id) => loadSession(id, 'deepqwen')}
              onNewChat={() => createNewChat('deepqwen')}
              onDeleteSession={handleDeleteSession}
              refreshTrigger={historyRefreshTrigger}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              {/* Header */}
              <div className="flex-none p-4 border-b border-white/10">
                <header className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold text-orange-600 drop-shadow-sm">DeepSeek-R1-Distill-Qwen-32B</h1>
                    <p className="text-xs text-stone-500">
                      🧠 Chain-of-Thought 추론 · 복잡한 문제 해결 · 32K 토큰
                    </p>
                  </div>
                  {/* Removed duplicate stop button from header, now in input area */}
                </header>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" className="mb-4 text-orange-300">
                      <path d="M20.5 12c0 4.5-3.5 8-8.5 8-3.5 0-6.5-2-8-5 0 0 1.5 1 3.5 1 3 0 5-2.5 5-5s-2-4.5-5-4.5c-1.5 0-2.5.5-3 1C6 5 8.5 4 12 4c5 0 8.5 3.5 8.5 8z" />
                      <circle cx="8" cy="10" r="1.5" />
                      <path d="M4 8c-1-1-2-1-2-1s.5 1 1 2c.5 1 1 1.5 1 1.5S3.5 9.5 4 8z" />
                    </svg>
                    <p className="text-lg font-medium">Ask me anything. I can think deeply.</p>
                  </div>
                )}

                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`${msg.role === "user" ? "max-w-[80%] bg-orange-400 text-white rounded-2xl rounded-tr-sm" : "w-full bg-white border border-stone-100 rounded-2xl rounded-tl-sm"} shadow-sm p-4`}>

                      {/* Reasoning Section (Collapsible) */}
                      {msg.role === "assistant" && msg.reasoning && (
                        <div className="mb-3 border-l-2 border-orange-200 pl-3">
                          <button
                            onClick={() => setExpandedReasoning(expandedReasoning === idx ? null : idx)}
                            className="text-xs font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2 hover:text-orange-700 mb-1"
                          >
                            <span>{expandedReasoning === idx ? "▼" : "▶"}</span>
                            Thought Process
                          </button>
                          {expandedReasoning === idx && (
                            <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded mt-1 whitespace-pre-wrap leading-relaxed animate-fade-in">
                              {msg.reasoning}
                            </div>
                          )}
                        </div>
                      )}

                      <div className={`text-base leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-stone-800"}`}>
                        {msg.role === "assistant" && !msg.content && !msg.reasoning ? (
                          <span className="animate-pulse">Thinking...</span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="flex-none px-6 py-4 bg-white/60 border-t border-white/20">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Attached File Preview */}
                {attachedFile && (
                  <div className="mb-3 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm text-orange-700 font-medium truncate flex-1">{attachedFile.name}</span>
                    {isUploading ? (
                      <span className="text-xs text-orange-500 animate-pulse">업로드 중...</span>
                    ) : (
                      <span className="text-xs text-green-600">✓ 첨부됨</span>
                    )}
                    <button
                      onClick={handleFileRemove}
                      className="p-1 hover:bg-orange-100 rounded text-orange-500 hover:text-red-500 transition-colors"
                      title="파일 제거"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Upload Error */}
                {uploadError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {uploadError}
                    <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}

                <div className="flex gap-2 relative">
                  {/* Attach File Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="bg-white border border-stone-200 text-stone-500 rounded-xl px-3 hover:bg-stone-50 hover:text-orange-500 hover:border-orange-300 disabled:opacity-50 transition-all"
                    title="파일 첨부 (PDF, TXT, DOCX)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }}
                    placeholder={attachedFile ? "첨부된 문서에 대해 질문하세요..." : "Type your message..."}
                    className="flex-1 bg-white border-none rounded-xl p-3 shadow-inner focus:ring-2 focus:ring-orange-500/50 resize-none h-14"
                  />

                  {isChatStreaming ? (
                    <button
                      onClick={handleStop}
                      className="bg-red-500 text-white rounded-xl px-4 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all active:scale-95 animate-pulse"
                      title="Stop Generating"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleChatSubmit}
                      disabled={!chatInput.trim()}
                      className="bg-orange-500 text-white rounded-xl px-4 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    </button>
                  )}
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-slate-400">DeepSeek-R1 can make mistakes. Check important info. {attachedFile && "📎 문서 첨부됨"}</span>
                </div>
              </div>
            </div>
          </main>
        ) : activeTab === "llama" ? (
          /* LLAMA 3.3 Chat Interface */
          <main className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex overflow-hidden relative ring-1 ring-black/5 animate-fade-in-up">
            <HistorySidebar
              modelType="llama"
              currentSessionId={llamaSessionId}
              onSelectSession={(id) => loadSession(id, 'llama')}
              onNewChat={() => createNewChat('llama')}
              onDeleteSession={handleDeleteSession}
              refreshTrigger={historyRefreshTrigger}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
              {/* Header */}
              <div className="flex-none p-4 border-b border-white/10">
                <header className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold text-orange-600 drop-shadow-sm">Llama 3.3 Q4</h1>
                    <p className="text-xs text-stone-500">
                      🦙 Meta AI 최신 모델 · 70B 파라미터 · 128K 컨텍스트 윈도우
                    </p>
                  </div>
                  {/* Header Stop button logic kept but hidden if redundant, or maybe remove it here if present in input? I'm removing it to avoid clutter since it's in the input now. */}
                </header>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {llamaMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" className="mb-4 text-orange-300">
                      <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.5 1 3.5-.5.5-1 1.5-1 2.5 0 1.5 1 3 2.5 3.5 0 1 .5 2 1.5 3 1 1 2.5 1.5 4 1.5s3-.5 4-1.5c1-1 1.5-2 1.5-3 1.5-.5 2.5-2 2.5-3.5 0-1-.5-2-1-2.5.5-1 1-2 1-3.5 0-2.5-2.5-5-6-5z" />
                      <circle cx="9.5" cy="8" r="1" />
                      <circle cx="14.5" cy="8" r="1" />
                    </svg>
                    <p className="text-lg font-medium">무엇이든 물어보세요. 빠르고 정확하게 답변합니다.</p>
                  </div>
                )}

                {llamaMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`${msg.role === "user" ? "max-w-[80%] bg-orange-400 text-white rounded-2xl rounded-tr-sm" : "w-full bg-white border border-stone-100 rounded-2xl rounded-tl-sm"} shadow-sm p-4`}>
                      <div className={`text-base leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "text-white" : "text-stone-800"}`}>
                        {msg.role === "assistant" && !msg.content ? (
                          <span className="animate-pulse">생성 중...</span>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={llamaEndRef} />
              </div>

              {/* Input Area */}
              <div className="flex-none px-6 py-4 bg-white/60 border-t border-white/20">
                {/* Hidden File Input (Llama) */}
                <input
                  ref={llamaFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={handleLlamaFileSelect}
                  className="hidden"
                />

                {/* Attached File Preview (Llama) */}
                {llamaAttachedFile && (
                  <div className="mb-3 flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="text-sm text-orange-700 font-medium truncate flex-1">{llamaAttachedFile.name}</span>
                    {isLlamaUploading ? (
                      <span className="text-xs text-orange-500 animate-pulse">업로드 중...</span>
                    ) : (
                      <span className="text-xs text-green-600">✓ 첨부됨</span>
                    )}
                    <button
                      onClick={handleLlamaFileRemove}
                      className="p-1 hover:bg-orange-100 rounded text-orange-500 hover:text-red-500 transition-colors"
                      title="파일 제거"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Upload Error (Llama) */}
                {llamaUploadError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {llamaUploadError}
                    <button onClick={() => setLlamaUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
                  </div>
                )}

                <div className="flex gap-2 relative">
                  {/* Attach File Button (Llama) */}
                  <button
                    onClick={() => llamaFileInputRef.current?.click()}
                    disabled={isLlamaUploading}
                    className="bg-white border border-stone-200 text-stone-500 rounded-xl px-3 hover:bg-stone-50 hover:text-orange-500 hover:border-orange-300 disabled:opacity-50 transition-all"
                    title="파일 첨부 (PDF, TXT, DOCX)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>

                  <textarea
                    value={llamaInput}
                    onChange={(e) => setLlamaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleLlamaSubmit();
                      }
                    }}
                    placeholder={llamaAttachedFile ? "첨부된 문서에 대해 질문하세요..." : "Type your message..."}
                    className="flex-1 bg-white border-none rounded-xl p-3 shadow-inner focus:ring-2 focus:ring-orange-500/50 resize-none h-14"
                  />

                  {isLlamaStreaming ? (
                    <button
                      onClick={handleStop}
                      className="bg-red-500 text-white rounded-xl px-4 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all active:scale-95 animate-pulse"
                      title="Stop Generating"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleLlamaSubmit}
                      disabled={!llamaInput.trim()}
                      className="bg-orange-500 text-white rounded-xl px-4 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    </button>
                  )}
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-slate-400">Llama 3.3은 Meta AI의 오픈소스 모델입니다.</span>
                </div>
              </div>
            </div>
          </main>
        ) : activeTab === "debate" ? (
          /* AI Debate Interface */
          <main className="w-full h-full max-w-[1920px] bg-transparent flex overflow-hidden relative animate-fade-in-up">
            <HistorySidebar
              modelType="debate"
              currentSessionId={debateSessionId}
              onSelectSession={(id) => loadSession(id, 'debate')}
              onNewChat={() => createNewChat('debate')}
              onDeleteSession={handleDeleteSession}
              refreshTrigger={historyRefreshTrigger}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative p-4">
              <AiDebateInterface
                sessionId={debateSessionId}
                initialMessages={debateMessages}
                onSessionCreate={(id) => {
                  setDebateSessionId(id);
                  refreshHistory();
                }}
              />
            </div>
          </main>
        ) : (
          /* Placeholder for other tabs */
          <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in-up">
            <div className="w-24 h-24 rounded-3xl bg-white/30 backdrop-blur-md shadow-xl flex items-center justify-center mb-6 border border-white/50">
              <span className="text-4xl">🛠️</span>
            </div>
            <h2 className="text-3xl font-bold text-white drop-shadow-md mb-2 capitalize">{activeTab}</h2>
            <p className="text-white/80 font-medium">This feature is coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
