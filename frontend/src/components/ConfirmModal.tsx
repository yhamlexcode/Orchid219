"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
};

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false,
}: ConfirmModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent scrolling when modal is open
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!mounted) return null;
    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div
                className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-6 w-full max-w-sm transform transition-all scale-100 opacity-100"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center">
                    {/* Icon based on destructive or not */}
                    <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${isDestructive ? "bg-red-100" : "bg-orange-100"}`}>
                        {isDestructive ? (
                            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        ) : (
                            <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>

                    <h3 className="text-lg font-medium text-stone-900 mb-2">{title}</h3>
                    <p className="text-sm text-stone-500 mb-6">{message}</p>

                    <div className="flex gap-3 justify-center">
                        <button
                            type="button"
                            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500 transition-colors"
                            onClick={onClose}
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors shadow-sm ${isDestructive
                                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                                : "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
                                }`}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
