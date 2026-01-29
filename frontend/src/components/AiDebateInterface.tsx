"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
    role: "deepqwen" | "exaone";
    content: string;
    thinking?: string; // For DeepQwen's CoT
};

type Language = "ko" | "en";
type InteractionMode = "debate" | "empathy" | "persuasion";

export default function AiDebateInterface({
    sessionId,
    initialMessages = [],
    onSessionCreate
}: {
    sessionId: string | null;
    initialMessages?: Message[];
    onSessionCreate: (id: string, title: string) => void;
}) {
    const [isAuto, setIsAuto] = useState(false);
    const [topic, setTopic] = useState("");
    const [language, setLanguage] = useState<Language>("ko");
    const [mode, setMode] = useState<InteractionMode>("debate");
    const [messages, setMessages] = useState<Message[]>([]);
    const [turnState, setTurnState] = useState<
        "idle" | "deepqwen_thinking" | "waiting_for_exaone" | "exaone_thinking" | "waiting_for_deepqwen"
    >("idle");
    const [error, setError] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

    const deepqwenEndRef = useRef<HTMLDivElement>(null);
    const exaoneEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Initialize from history
    useEffect(() => {
        if (initialMessages.length > 0) {
            setMessages(initialMessages);
            // Restore state based on last message
            const lastMsg = initialMessages[initialMessages.length - 1];
            if (lastMsg.role === "deepqwen") {
                setTurnState("waiting_for_exaone");
            } else {
                setTurnState("waiting_for_deepqwen");
            }
        } else if (!sessionId) {
            // New chat
            setMessages([]);
            setTurnState("idle");
            setTopic("");
        }
    }, [initialMessages, sessionId]);

    // Auto-scroll logic
    useEffect(() => {
        deepqwenEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        exaoneEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-Debate Trigger Logic
    useEffect(() => {
        if (!isAuto) return;

        let timer: NodeJS.Timeout;

        if (turnState === 'waiting_for_exaone') {
            timer = setTimeout(() => {
                handleReplyExaone();
            }, 2000); // 2 second delay for reading buffer
        } else if (turnState === 'waiting_for_deepqwen') {
            timer = setTimeout(() => {
                handleReplyDeepQwen();
            }, 2000);
        }

        return () => clearTimeout(timer);
    }, [turnState, isAuto, messages]); // Listen to messages to trigger after update

    // Guidelines generator based on Mode and Language
    const getGuidelines = (lang: Language, mode: InteractionMode) => {
        let coreGuidelines = "";

        switch (mode) {
            case "debate":
                coreGuidelines = `
1. **Goal**: Win the argument with logic.
2. Critically analyze the opponent's argument.
3. Provide a logical counter-argument.
4. **Tone**: Casual but analytical. Friendly rivalry.
`;
                break;
            case "empathy":
                coreGuidelines = `
1. **Goal**: Deeply understand and validate the other's feelings/perspective.
2. Listen actively and reflect on what they said.
3. Do NOT argue. Offer support, comfort, or shared experiences.
4. **Tone**: Warm, gentle, supportive, and kind. Like a caring friend.
`;
                break;
            case "persuasion":
                coreGuidelines = `
1. **Goal**: Convince the other person to adopt your viewpoint.
2. Use rhetorical devices (metaphors, analogies).
3. Appeal to both logic and emotion.
4. Find common ground, then lead them to your conclusion.
5. **Tone**: Confident, charming, and compelling.
`;
                break;
        }

        const common = `
${coreGuidelines}
5. Stay focused on the topic: "${topic}".
6. **Length**: Concise and natural (3-5 sentences). Avoid "AI-like" lecturing.
`;

        if (lang === 'ko') {
            return `${common}\n7. **MUST RESPOND IN KOREAN ONLY.**\n8. **Use 'Haeyo-che' (해요체).** Be polite but friendly (e.g., "~했어요", "~인 것 같아요").`;
        } else {
            return `${common}\n7. **MUST RESPOND IN ENGLISH ONLY.**\n8. Use natural spoken English.`;
        }
    };

    const handleStartDebate = async () => {
        if (!topic.trim()) return;

        // 1. Create Session first
        try {
            const res = await fetch(`${API_URL}/api/history/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model_type: "debate",
                    title: topic
                }),
            });

            if (!res.ok) throw new Error("Failed to create session");
            const session = await res.json();
            onSessionCreate(session.id, session.title);

            // 2. Start Conversation
            setMessages([]);
            setTurnState("deepqwen_thinking");
            setError(null);

            const guidelines = getGuidelines(language, mode);

            // Initial System Prompt Construction
            const systemContent = `
[Role]
You are DeepQwen. 
Current Mode: **${mode.toUpperCase()}**.
${mode === 'empathy' ? 'You are a warm, empathetic listener.' : mode === 'persuasion' ? 'You are a charismatic persuader.' : 'You are a logical debater.'}

[Topic]
"${topic}"

[Guidelines]
${guidelines}
`;

            const initialPrompt = `
[Instruction]
Start the conversation about the topic: "${topic}".
Express your initial thoughts naturally.
Remember to respond in ${language === 'ko' ? 'Korean' : 'English'}.
`;
            // Pass session.id explicitly since state might not update fast enough if we relied on prop
            await generateResponse("deepqwen", session.id, [
                { role: "system", content: systemContent },
                { role: "user", content: initialPrompt }
            ]);

        } catch (err) {
            console.error(err);
            setError("Failed to start debate session");
        }
    };

    const handleReplyExaone = async () => {
        if (!sessionId) return;
        setTurnState("exaone_thinking");

        const guidelines = getGuidelines(language, mode);

        // Construct History
        // ExaOne is "assistant", DeepQwen is "user"
        const history = messages.map(m => ({
            role: m.role === "exaone" ? "assistant" : "user",
            content: m.content
        }));

        const systemContent = `
[Role]
You are ExaOne.
Current Mode: **${mode.toUpperCase()}**.
${mode === 'empathy' ? 'You are a kind, understanding friend.' : mode === 'persuasion' ? 'You are a compelling negotiator.' : 'You are a sharp debater.'}

[Topic]
"${topic}"

[Guidelines]
${guidelines}
`;

        const instructionWrapper = `
[Instruction]
Reply to the opponent's last message.
Follow the current mode's goal (Debate, Empathy, or Persuasion).
Remember to respond in ${language === 'ko' ? 'Korean' : 'English'}.
`;

        // The last message in 'history' is already the opponent's message (as 'user')
        // We append the instruction to the last message or as a system reminder?
        // Better: Append a specialized "user" message that includes the instruction if needed, 
        // OR just rely on the system prompt driving the behavior.
        // To be safe and explicit:

        const payloadMessages = [
            { role: "system", content: systemContent },
            ...history,
            { role: "user", content: instructionWrapper } // Reinforce instruction at the end
        ];

        await generateResponse("exaone", sessionId, payloadMessages);
    };

    const handleReplyDeepQwen = async () => {
        if (!sessionId) return;
        setTurnState("deepqwen_thinking");

        const guidelines = getGuidelines(language, mode);

        // Construct History
        // DeepQwen is "assistant", ExaOne is "user"
        const history = messages.map(m => ({
            role: m.role === "deepqwen" ? "assistant" : "user",
            content: m.content
        }));

        const systemContent = `
[Role]
You are DeepQwen.
Current Mode: **${mode.toUpperCase()}**.
${mode === 'empathy' ? 'You are a warm, empathetic listener.' : mode === 'persuasion' ? 'You are a charismatic persuader.' : 'You are a logical debater.'}

[Topic]
"${topic}"

[Guidelines]
${guidelines}
`;

        const instructionWrapper = `
[Instruction]
Reply to the opponent's last message.
Follow the current mode's goal (Debate, Empathy, or Persuasion).
Remember to respond in ${language === 'ko' ? 'Korean' : 'English'}.
`;

        const payloadMessages = [
            { role: "system", content: systemContent },
            ...history,
            { role: "user", content: instructionWrapper }
        ];

        await generateResponse("deepqwen", sessionId, payloadMessages);
    };

    // Modified to accept full messages array
    const generateResponse = async (modelRole: "deepqwen" | "exaone", activeSessionId: string, messagesPayload: { role: string, content: string }[]) => {
        abortControllerRef.current = new AbortController();

        // Create placeholder message
        const newMessage: Message = { role: modelRole, content: "", thinking: modelRole === "deepqwen" ? "" : undefined };
        setMessages(prev => [...prev, newMessage]);

        const modelId = modelRole === "deepqwen" ? "deepseek-r1:32b" : "exaone4.0:32b";

        try {
            const response = await fetch(`${API_URL}/api/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: messagesPayload,
                    model: modelId,
                    session_id: activeSessionId
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error("Generaton failed");

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
                        if (data === "[DONE]") continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                rawContent += parsed.content;

                                // Parse logic (similar to page.tsx)
                                if (modelRole === "deepqwen") {
                                    if (rawContent.includes("<think>")) {
                                        if (rawContent.includes("</think>")) {
                                            const parts = rawContent.split("</think>");
                                            reasoning = parts[0].replace("<think>", "");
                                            finalContent = parts[1];
                                        } else {
                                            reasoning = rawContent.replace("<think>", "");
                                            finalContent = "";
                                        }
                                    } else {
                                        finalContent = rawContent;
                                    }
                                } else {
                                    finalContent = rawContent; // ExaOne doesn't have <think> usually
                                }

                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    const last = newMsgs[newMsgs.length - 1];
                                    last.content = finalContent;
                                    if (modelRole === "deepqwen") last.thinking = reasoning;
                                    return newMsgs;
                                });
                            }
                        } catch { }
                    }
                }
            }

            // Turn finished
            if (modelRole === "deepqwen") {
                setTurnState("waiting_for_exaone");
            } else {
                setTurnState("waiting_for_deepqwen");
            }

        } catch (err) {
            if (err instanceof Error && err.name !== "AbortError") {
                setError(err.message);
                setTurnState("idle"); // Reset on error
                setIsAuto(false); // Stop auto on error
            }
        }
    };

    const handleStop = () => {
        abortControllerRef.current?.abort();
        setIsAuto(false); // Stop auto if manually stopped
        setTurnState(prev => {
            if (prev === "deepqwen_thinking") return "waiting_for_exaone";
            if (prev === "exaone_thinking") return "waiting_for_deepqwen";
            return prev;
        });
    };

    const handleReset = () => {
        handleStop();
        setMessages([]);
        setTopic("");
        setTurnState("idle");
    };

    return (
        <div className="w-full h-full max-w-[1920px] bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex flex-col relative overflow-hidden ring-1 ring-black/5 animate-fade-in-up">
            {/* Header */}
            <div className="flex-none p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text drop-shadow-sm">
                        AI Arena
                    </h1>
                    <p className="text-xs text-stone-500">
                        🤖 DeepQwen vs 🟣 ExaOne · Interactive AI Conversation · {language === 'ko' ? "한국어" : "English"}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    {/* Auto Checkbox */}
                    {turnState !== "idle" && (
                        <label className="flex items-center gap-2 cursor-pointer mr-2 px-3 py-1.5 bg-white/50 rounded-lg hover:bg-white/80 transition-colors border border-stone-200">
                            <input
                                type="checkbox"
                                checked={isAuto}
                                onChange={(e) => setIsAuto(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`text-xs font-bold ${isAuto ? 'text-blue-600' : 'text-stone-500'}`}>
                                Auto-Debate {isAuto && <span className="animate-pulse">⚡️</span>}
                            </span>
                        </label>
                    )}

                    {/* Only show Reset if actively debating. The 'New Chat' sidebar button is cleaner for new sessions. */}
                    {turnState !== "idle" && (
                        <button onClick={handleReset} className="px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 rounded-lg transition-colors">
                            End / Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Main Split View */}
            <div className="flex-1 flex gap-px min-h-0 bg-stone-200/50">

                {/* Left Panel: DeepQwen */}
                <div className="flex-1 flex flex-col bg-white/50 relative">
                    <div className={`p-3 border-b border-white/10 flex justify-between items-center ${mode === 'empathy' ? 'bg-green-50/50' : 'bg-orange-50/50'}`}>
                        <span className={`font-bold text-sm flex items-center gap-2 ${mode === 'empathy' ? 'text-green-600' : 'text-orange-600'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 12c0 4.5-3.5 8-8.5 8-3.5 0-6.5-2-8-5 0 0 1.5 1 3.5 1 3 0 5-2.5 5-5s-2-4.5-5-4.5c-1.5 0-2.5.5-3 1C6 5 8.5 4 12 4c5 0 8.5 3.5 8.5 8z" /><circle cx="8" cy="10" r="1.5" /><path d="M4 8c-1-1-2-1-2-1s.5 1 1 2c.5 1 1 1.5 1 1.5S3.5 9.5 4 8z" /></svg>
                            DeepQwen ({mode})
                        </span>
                        {turnState === "deepqwen_thinking" && (
                            <span className={`text-xs animate-pulse font-medium ${mode === 'empathy' ? 'text-green-500' : 'text-orange-500'}`}>
                                thinking...
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.filter(m => m.role === "deepqwen").map((msg, i) => (
                            <div key={i} className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm animate-fade-in">
                                {msg.thinking && (
                                    <details className="mb-2 text-xs text-stone-400">
                                        <summary className="cursor-pointer hover:text-stone-600 transition-colors">Thought Process</summary>
                                        <div className="mt-1 p-2 bg-stone-50 rounded italic">{msg.thinking}</div>
                                    </details>
                                )}
                                <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        ))}
                        <div ref={deepqwenEndRef}></div>
                    </div>
                    {/* Action Bar */}
                    <div className="p-4 border-t border-white/20 bg-white/30 backdrop-blur-sm">
                        {turnState === "waiting_for_deepqwen" ? (
                            <button
                                onClick={handleReplyDeepQwen}
                                className={`w-full py-3 text-white rounded-xl shadow-lg transition-all active:scale-95 font-medium flex items-center justify-center gap-2 ${mode === 'empathy' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'}`}
                            >
                                <span>Reply with DeepQwen</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        ) : turnState === "deepqwen_thinking" ? (
                            <button onClick={handleStop} className="w-full py-3 bg-red-100 text-red-500 hover:bg-red-200 rounded-xl transition-colors font-medium">Stop</button>
                        ) : (
                            <div className="h-12 flex items-center justify-center text-stone-400 text-sm italic">Waiting for turn...</div>
                        )}
                    </div>
                </div>

                {/* Right Panel: ExaOne */}
                <div className="flex-1 flex flex-col bg-white/50 relative">
                    <div className={`p-3 border-b border-white/10 flex justify-between items-center ${mode === 'empathy' ? 'bg-blue-50/50' : 'bg-purple-50/50'}`}>
                        <span className={`font-bold text-sm flex items-center gap-2 ${mode === 'empathy' ? 'text-blue-600' : 'text-purple-600'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M12 2L20 8V10L12 6L4 10V8L12 2Z" fill="currentColor" /><path d="M4 10L4 16L6 17L6 12L12 8L4 10Z" fill="currentColor" /><path d="M12 16L20 12V18L12 22L4 18V16L12 20L20 16V12L12 16Z" fill="currentColor" /></svg>
                            ExaOne ({mode})
                        </span>
                        {turnState === "exaone_thinking" && (
                            <span className={`text-xs animate-pulse font-medium ${mode === 'empathy' ? 'text-blue-500' : 'text-purple-500'}`}>
                                thinking...
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.filter(m => m.role === "exaone").map((msg, i) => (
                            <div key={i} className="bg-white border border-stone-100 rounded-xl p-4 shadow-sm animate-fade-in">
                                <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        ))}
                        <div ref={exaoneEndRef}></div>
                    </div>
                    {/* Action Bar */}
                    <div className="p-4 border-t border-white/20 bg-white/30 backdrop-blur-sm">
                        {turnState === "waiting_for_exaone" ? (
                            <button
                                onClick={handleReplyExaone}
                                className={`w-full py-3 text-white rounded-xl shadow-lg transition-all active:scale-95 font-medium flex items-center justify-center gap-2 ${mode === 'empathy' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20' : 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/20'}`}
                            >
                                <span>Reply with ExaOne</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        ) : turnState === "exaone_thinking" ? (
                            <button onClick={handleStop} className="w-full py-3 bg-red-100 text-red-500 hover:bg-red-200 rounded-xl transition-colors font-medium">Stop</button>
                        ) : (
                            <div className="h-12 flex items-center justify-center text-stone-400 text-sm italic">Waiting for turn...</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Start Overlay (if idle) */}
            {turnState === "idle" && messages.length === 0 && (
                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-xl p-6 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">{mode === 'debate' ? '⚔️' : mode === 'empathy' ? '❤️' : '🎮'}</span>
                        </div>
                        <h2 className="text-xl font-bold text-stone-800 mb-2">Start AI Arena</h2>
                        <p className="text-stone-500 text-sm mb-6">Choose a mode and topic to start conversation.</p>

                        {/* Language Selector */}
                        <div className="flex justify-center gap-2 mb-4">
                            <button
                                onClick={() => setLanguage('ko')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${language === 'ko' ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-200' : 'bg-stone-100 text-stone-500'}`}
                            >
                                한국어
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${language === 'en' ? 'bg-blue-100 text-blue-600 ring-1 ring-blue-200' : 'bg-stone-100 text-stone-500'}`}
                            >
                                English
                            </button>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex justify-center gap-2 mb-6 p-1 bg-stone-100 rounded-xl">
                            {(['debate', 'persuasion', 'empathy'] as const).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all capitalize ${mode === m
                                        ? 'bg-white text-stone-800 shadow-sm'
                                        : 'text-stone-400 hover:text-stone-600'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={language === 'ko' ? "대화 주제를 입력하세요..." : "Enter conversation topic..."}
                            className="w-full h-24 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none mb-4 text-sm"
                        />

                        <button
                            onClick={handleStartDebate}
                            disabled={!topic.trim()}
                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'empathy' ? 'bg-gradient-to-r from-green-400 to-blue-400' :
                                mode === 'persuasion' ? 'bg-gradient-to-r from-purple-500 to-pink-500' :
                                    'bg-gradient-to-r from-orange-400 to-red-400'
                                }`}
                        >
                            Start {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
