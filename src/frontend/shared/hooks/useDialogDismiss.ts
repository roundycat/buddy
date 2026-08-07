"use client";

import { useEffect } from "react";

/**
 * Escape-to-close, background scroll lock, and focus restore for sheets/modals.
 * Every `role="dialog"` surface should use this so keyboard users are never
 * trapped without Escape and focus returns to the opener when the dialog closes.
 */
export function useDialogDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      // Restore focus to whatever opened the dialog (button, leaf, flower…).
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);
}
