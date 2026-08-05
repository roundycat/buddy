"use client";

import { useEffect } from "react";
import {
  PRIVACY_COLLECTION,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from "@/frontend/features/auth/lib/legal-copy";

export type LegalDocId = "terms" | "privacy-collection" | "privacy-policy";

const DOCS: Record<
  LegalDocId,
  {
    title: string;
    updatedAt: string;
    sections: ReadonlyArray<{ heading: string; body: string }>;
    table?: typeof PRIVACY_COLLECTION.summaryRows;
    notice?: string;
  }
> = {
  terms: TERMS_OF_SERVICE,
  "privacy-collection": {
    title: PRIVACY_COLLECTION.title,
    updatedAt: PRIVACY_COLLECTION.updatedAt,
    sections: PRIVACY_COLLECTION.sections,
    table: PRIVACY_COLLECTION.summaryRows,
    notice: PRIVACY_COLLECTION.notice,
  },
  "privacy-policy": PRIVACY_POLICY,
};

/**
 * Full-screen-ish modal for reading signup legal documents.
 */
export function LegalDocumentModal({
  docId,
  onClose,
}: {
  docId: LegalDocId | null;
  onClose: () => void;
}) {
  const doc = docId ? DOCS[docId] : null;

  useEffect(() => {
    if (!doc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [doc, onClose]);

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bedi-slate/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-doc-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bedi-slate/8 px-4 py-3">
          <div>
            <h2
              id="legal-doc-title"
              className="text-base font-semibold text-bedi-slate"
            >
              {doc.title}
            </h2>
            <p className="mt-0.5 text-[11px] text-bedi-slate/40">
              시행일 {doc.updatedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-bedi-slate/50 hover:bg-bedi-slate/5 hover:text-bedi-slate"
          >
            닫기
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4 text-left">
          {doc.table && (
            <div className="overflow-hidden rounded-xl border border-bedi-slate/10">
              <table className="w-full text-left text-[11px] text-bedi-slate/70">
                <thead className="bg-bedi-slate/5 text-bedi-slate/50">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">목적</th>
                    <th className="px-2.5 py-2 font-medium">항목</th>
                    <th className="px-2.5 py-2 font-medium">보유</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.table.map((row) => (
                    <tr
                      key={row.purpose}
                      className="border-t border-bedi-slate/8 align-top"
                    >
                      <td className="px-2.5 py-2">{row.purpose}</td>
                      <td className="px-2.5 py-2">{row.items}</td>
                      <td className="px-2.5 py-2">{row.retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-1.5">
              <h3 className="text-sm font-medium text-bedi-slate">
                {section.heading}
              </h3>
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-bedi-slate/60">
                {section.body}
              </p>
            </section>
          ))}

          {doc.notice && (
            <p className="rounded-xl bg-bedi-sage/10 px-3 py-2 text-[11px] leading-relaxed text-bedi-slate/65">
              {doc.notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
