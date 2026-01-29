"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import ConfirmModal from "./ConfirmModal";
type Session = {
    id: string;
    title: string;
    updated_at: string;
};

type HistorySidebarProps = {
    modelType: string;
    currentSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onDeleteSession: (sessionId: string) => void;
    refreshTrigger: number; // Increment to force refresh
};

export default function HistorySidebar({
    modelType,
    currentSessionId,
    onSelectSession,
    onNewChat,
    onDeleteSession,
    refreshTrigger,
}: HistorySidebarProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

    useEffect(() => {
        fetchSessions();
    }, [modelType, refreshTrigger]);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/history/${modelType}`);
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSessionToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!sessionToDelete) return;

        try {
            const res = await fetch(`${API_URL}/api/history/session/${sessionToDelete}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
                onDeleteSession(sessionToDelete);
            }
        } catch (err) {
            console.error("Failed to delete session:", err);
        } finally {
            setDeleteModalOpen(false);
            setSessionToDelete(null);
        }
    };

    const startEditing = (e: React.MouseEvent, session: Session) => {
        e.stopPropagation();
        setEditingId(session.id);
        setEditTitle(session.title);
    };

    const saveTitle = async (id: string) => {
        try {
            const res = await fetch(`${API_URL}/api/history/session/${id}/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editTitle }),
            });
            if (res.ok) {
                setSessions((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, title: editTitle } : s))
                );
                setEditingId(null);
            }
        } catch (err) {
            console.error("Failed to update title:", err);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === "Enter") {
            saveTitle(id);
        } else if (e.key === "Escape") {
            setEditingId(null);
        }
    };

    return (
        <div
            className={`
        relative flex flex-col h-full bg-white/30 backdrop-blur-md border-r border-white/20 transition-all duration-300 ease-in-out
        ${isCollapsed ? "w-0 p-0 overflow-hidden" : "w-64"}
      `}
        >
            {/* Collapse Toggle Button (Outside when collapsed) */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`absolute top-1/2 -right-3 z-10 w-6 h-12 bg-white border border-stone-200 rounded-r-lg shadow-sm flex items-center justify-center text-stone-400 hover:text-orange-500 transition-colors ${isCollapsed ? "translate-x-full" : ""
                    }`}
                title={isCollapsed ? "Show History" : "Hide History"}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transform transition-transform ${isCollapsed ? "rotate-180" : ""}`}
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>

            <div className={`flex flex-col h-full ${isCollapsed ? "hidden" : "block"}`}>
                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-stone-600">History</h2>
                    <button
                        onClick={onNewChat}
                        className="p-1.5 rounded-md hover:bg-white/50 text-stone-500 hover:text-orange-600 transition-colors"
                        title="New Chat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoading && sessions.length === 0 ? (
                        <div className="flex justify-center p-4">
                            <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => onSelectSession(session.id)}
                                className={`
                  group flex items-center gap-2 p-2.5 rounded-lg text-sm cursor-pointer transition-all
                  ${currentSessionId === session.id
                                        ? "bg-white/60 shadow-sm ring-1 ring-orange-100 text-stone-800 font-medium"
                                        : "text-stone-600 hover:bg-white/40 hover:text-stone-800"
                                    }
                `}
                            >
                                <div className="flex-1 min-w-0">
                                    {editingId === session.id ? (
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => saveTitle(session.id)}
                                            onKeyDown={(e) => handleKeyDown(e, session.id)}
                                            className="w-full bg-white border border-orange-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <>
                                            <p className="truncate">{session.title}</p>
                                            <p className="text-[10px] text-stone-400 truncate opacity-80">
                                                {format(new Date(session.updated_at), "M월 d일 a h:mm", { locale: ko })}
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Actions (Edit/Delete) - Visible on Hover or Active */}
                                <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${editingId === session.id ? 'hidden' : ''}`}>
                                    <button
                                        onClick={(e) => startEditing(e, session)}
                                        className="p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600"
                                        title="Rename"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(e, session.id)}
                                        className="p-1 rounded hover:bg-red-100 text-stone-400 hover:text-red-500"
                                        title="Delete"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="대화 삭제"
                message="정말 이 대화를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
                confirmText="삭제"
                cancelText="취소"
                isDestructive={true}
            />
        </div>
    );
}
