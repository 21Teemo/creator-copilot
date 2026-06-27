"use client";

import React, { useState, useEffect, useRef } from "react";
import { useResearchStore, stripMarkdown, type FactSource } from "@/stores/useResearchStore";
import { useStudioStore } from "@/stores/useStudioStore";
import {
  Search,
  Link as LinkIcon,
  AlertCircle,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Eye,
  Pencil,
} from "lucide-react";

interface FactsViewProps {
  onPush?: (prompt: string, action: string) => void;
}

type BriefBlock =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

function isListLine(line: string): boolean {
  return /^\s*(\d+[\.)]|[a-zA-Z][\.)]|[-•*])\s+/.test(line.trim());
}

function stripListMarker(line: string): string {
  return line.trim().replace(/^\d+[\.)]\s+/, "").replace(/^[a-zA-Z][\.)]\s+/, "").replace(/^[-•*]\s+/, "");
}

function isHeadingLine(line: string, isFirstBlock: boolean): boolean {
  const t = line.trim();
  if (!t || t.length > 72) return false;
  if (/^\d+[\.)]\s/.test(t)) return true;
  if (/^(overview|conclusion|topic|video overview|core hook|key narrative|narrative structure|visual format|tone|hashtag|target audience|key takeaways|suggested content|call to action)/i.test(t))
    return true;
  if (t.endsWith(":") && t.length < 48) return true;
  if (isFirstBlock && /^creator brief/i.test(t)) return true;
  if (!/[.!?]$/.test(t) && t.length < 42 && /^[A-Z]/.test(t)) return true;
  return false;
}

function parseBriefText(text: string): BriefBlock[] {
  const blocks: BriefBlock[] = [];
  const chunks = text.split(/\n\n+/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.length === 1) {
      const line = lines[0];
      if (isListLine(line)) {
        blocks.push({ type: "list", items: [stripListMarker(line)] });
      } else if (isHeadingLine(line, blocks.length === 0)) {
        blocks.push({ type: blocks.length === 0 ? "title" : "heading", text: line });
      } else {
        blocks.push({ type: "paragraph", text: line });
      }
      continue;
    }

    if (isHeadingLine(lines[0], blocks.length === 0)) {
      blocks.push({
        type: blocks.length === 0 ? "title" : "heading",
        text: lines[0].replace(/:$/, ""),
      });
      const body = lines.slice(1);
      const listItems = body.filter(isListLine);
      const paragraphs = body.filter((l) => !isListLine(l));
      paragraphs.forEach((p) => blocks.push({ type: "paragraph", text: p }));
      if (listItems.length > 0) {
        blocks.push({ type: "list", items: listItems.map(stripListMarker) });
      }
      continue;
    }

    const listItems = lines.filter(isListLine);
    const paragraphs = lines.filter((l) => !isListLine(l));
    paragraphs.forEach((p) => blocks.push({ type: "paragraph", text: p }));
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems.map(stripListMarker) });
    }
  }

  return blocks;
}

function FormattedBrief({ text }: { text: string }) {
  const blocks = parseBriefText(text);
  if (blocks.length === 0) {
    return <p className="text-sm text-studio-text-secondary italic">No brief content yet.</p>;
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {blocks.map((block, i) => {
        if (block.type === "title") {
          return (
            <h2 key={i} className="text-lg font-bold text-studio-text-primary tracking-tight border-b border-accent/20 pb-2">
              {block.text}
            </h2>
          );
        }
        if (block.type === "heading") {
          return (
            <h3 key={i} className="text-sm font-bold text-accent uppercase tracking-wide pt-1">
              {block.text}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-[13px] text-studio-text-primary leading-relaxed">
                  <span className="text-accent shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-[13px] text-studio-text-primary/90 leading-[1.75]">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function FormattedAnalysis({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i} className="text-xs text-studio-text-primary/90 leading-[1.7]">
          {para.trim()}
        </p>
      ))}
    </div>
  );
}

const EMPTY_SUGGESTIONS = [
  "How does photosynthesis work?",
  "Summarize the history of electronic music",
  "Research facts about the James Webb telescope",
];

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatCitations(sources: FactSource[]): string {
  return sources.map((s, i) => `[${i + 1}] ${s.title} – ${s.url}`).join("\n");
}

function CopyToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1A1F]/95 backdrop-blur-md border border-accent/30 shadow-2xl text-xs font-medium text-studio-text-primary animate-fade-in"
    >
      <Check size={14} className="text-green-400 shrink-0" />
      {message}
    </div>
  );
}

export default function FactsView({ onPush }: FactsViewProps) {
  const { summaries, updateSummaryText } = useResearchStore();
  const loading = useStudioStore((state) => state.loading);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedCitations, setCopiedCitations] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const cleanedRef = useRef(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleCopyBrief = async () => {
    if (!summaries?.summaryText) return;
    await navigator.clipboard.writeText(summaries.summaryText);
    setCopiedBrief(true);
    showToast("Brief copied to clipboard");
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const handleCopyCitations = async () => {
    if (!summaries?.sources.length) return;
    await navigator.clipboard.writeText(formatCitations(summaries.sources));
    setCopiedCitations(true);
    showToast("Citations copied to clipboard");
    setTimeout(() => setCopiedCitations(false), 2000);
  };

  const handleRegenerate = () => {
    onPush?.("Re-run fact finding", "fact_finder");
  };

  useEffect(() => {
    if (!summaries || cleanedRef.current) return;
    cleanedRef.current = true;
    const plain = stripMarkdown(summaries.summaryText);
    if (plain !== summaries.summaryText) {
      updateSummaryText(plain);
    }
  }, [summaries, updateSummaryText]);

  useEffect(() => {
    if (!loading) setIsEditing(false);
  }, [loading]);

  if (!summaries) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12 px-4">
        <Search size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-primary font-bold mb-1">No research facts available</p>
        <p className="text-xs text-studio-text-secondary max-w-sm mb-5">
          Enter a topic or paste a YouTube URL in the prompt bar below to gather verified research facts
          and summarize content.
        </p>
        {onPush && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold text-studio-text-secondary uppercase tracking-wider">
              Try an example
            </span>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {EMPTY_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onPush(suggestion, "fact_finder")}
                  className="px-3 py-1.5 rounded-full text-xs text-studio-text-primary bg-studio-bg border border-studio-border/60 hover:border-accent/40 hover:text-accent transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        <CopyToast message={toast} />
      </div>
    );
  }

  const wordCount = summaries.summaryText.split(/\s+/).filter(Boolean).length;
  const charCount = summaries.summaryText.length;
  const briefEmpty = summaries.summaryText.trim().length === 0;

  return (
    <div className="flex flex-col flex-1 h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary">
            Research Brief & Fact Summary
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Synthesized by Gemini based on top web search queries
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
          {/* Main Brief Panel */}
          <div className="lg:col-span-2 flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={14} className="text-accent shrink-0" />
                <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider truncate">
                  Synthesized Brief (Editable)
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing((v) => !v)}
                  aria-label={isEditing ? "Switch to formatted view" : "Edit research brief"}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    isEditing
                      ? "text-accent bg-accent/15 border border-accent/30"
                      : "text-studio-text-secondary hover:text-accent hover:bg-accent/10"
                  }`}
                >
                  <Pencil size={12} />
                  {isEditing ? "Preview" : "Edit"}
                </button>
                {onPush && (
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={loading}
                    aria-label="Regenerate research brief"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerate
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyBrief}
                  disabled={briefEmpty}
                  aria-label="Copy brief to clipboard"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {copiedBrief ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copiedBrief ? "Copied" : "Copy all"}
                </button>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-0 select-text overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 rounded-xl bg-studio-bg/30 border border-studio-border/50 focus-within:border-accent/40 transition-colors">
                {isEditing ? (
                  <textarea
                    value={summaries.summaryText}
                    onChange={(e) => updateSummaryText(e.target.value)}
                    aria-label="Edit research brief"
                    className="w-full h-full min-h-[280px] bg-transparent text-studio-text-primary text-[13px] leading-[1.75] focus:outline-none resize-none placeholder-studio-text-secondary/70 font-sans p-5 select-text"
                    placeholder="Review or edit the research brief summary..."
                  />
                ) : (
                  <div className="p-5">
                    <FormattedBrief text={summaries.summaryText} />
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-[10px] text-studio-text-secondary px-1 mt-2">
                <span>{wordCount} words</span>
                <span>{charCount} characters</span>
              </div>
              {onPush && (
                <div className="mt-3 pt-3.5 border-t border-studio-border/30 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onPush(
                        "Write a voiceover script and storyboard outline based on the research brief.",
                        "write_script"
                      )
                    }
                    disabled={briefEmpty || loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Working…
                      </>
                    ) : (
                      <>Confirm & Write Script &rarr;</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Visual Reference + Sources Panel */}
          <div className="flex flex-col gap-5 h-full min-h-0 overflow-hidden">
            {(summaries.visualAnalysis || summaries.thumbnailUrl) && (
              <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden shrink-0 max-h-[45%]">
                <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
                  <Eye size={14} className="text-accent shrink-0" />
                  <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                    Thumbnail Visual Analysis
                  </span>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 select-text">
                  {summaries.thumbnailUrl && (
                    <div className="rounded-xl overflow-hidden border border-studio-border/50 bg-black/40 max-w-[140px] mx-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={summaries.thumbnailUrl}
                        alt="Trend video thumbnail"
                        className="w-full aspect-[9/16] object-cover"
                      />
                    </div>
                  )}
                  {summaries.visualAnalysis ? (
                    <FormattedAnalysis text={summaries.visualAnalysis} />
                  ) : (
                    <p className="text-xs text-studio-text-secondary flex items-center gap-2">
                      <AlertCircle size={14} />
                      Analysis unavailable. Hit Regenerate with GEMINI_API_KEY set.
                    </p>
                  )}
                </div>
              </div>
            )}

          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden flex-1 min-h-0">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <LinkIcon size={14} className="text-accent shrink-0" />
                <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider truncate">
                  Web Sources & Citations ({summaries.sources.length})
                </span>
              </div>
              {summaries.sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyCitations}
                  aria-label="Copy citations to clipboard"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  {copiedCitations ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                  {copiedCitations ? "Copied" : "Copy citations"}
                </button>
              )}
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {summaries.sources.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-studio-text-secondary">
                  <AlertCircle size={14} />
                  No sources cited.
                </div>
              ) : (
                summaries.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={source.snippet || source.url}
                    className="block p-3 rounded-xl bg-studio-bg border border-studio-border/50 hover:border-accent/40 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-xs font-bold text-studio-text-primary line-clamp-1 hover:text-accent flex-1">
                        {source.title}
                      </h4>
                      <span className="text-[9px] font-semibold text-accent px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 shrink-0">
                        [{index + 1}]
                      </span>
                    </div>
                    {source.snippet && (
                      <p
                        className="text-[10px] text-studio-text-secondary line-clamp-2 leading-relaxed"
                        title={source.snippet}
                      >
                        {source.snippet}
                      </p>
                    )}
                    <span className="text-[9px] text-accent mt-2 block truncate" title={source.url}>
                      {getDomain(source.url)}
                    </span>
                  </a>
                ))
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <CopyToast message={toast} />
    </div>
  );
}
