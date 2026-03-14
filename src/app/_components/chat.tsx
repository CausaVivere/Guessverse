"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useParty } from "~/utils/PartyProvider";
import { cn } from "~/lib/utils";

function twColor500ToRgb(color: string): string {
  // These map to Tailwind's default palette (approx), good enough for subtle chat tinting.
  // If a color is unknown, fall back to a neutral gray.
  switch (color) {
    case "red-500":
      return "239 68 68";
    case "blue-500":
      return "59 130 246";
    case "violet-500":
      return "139 92 246";
    case "yellow-500":
      return "234 179 8";
    case "purple-500":
      return "168 85 247";
    case "orange-500":
      return "249 115 22";
    case "pink-500":
      return "236 72 153";
    case "teal-500":
      return "20 184 166";
    default:
      return "148 163 184"; // slate-400-ish
  }
}

export default function Chat({ className }: { className?: string }) {
  const { roomState, connected, playerId, sendMessage } = useParty();
  const [draft, setDraft] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const playersById = useMemo(() => {
    const map = new Map<string, { name: string; color?: string }>();
    for (const p of roomState?.players ?? []) {
      map.set(p.id, { name: p.name, color: p.color });
    }
    return map;
  }, [roomState?.players]);

  const messages = roomState?.chat ?? [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const msg = draft.trim();
    if (!msg) return;
    sendMessage(msg);
    setDraft("");
  };

  return (
    <div
      className={cn(
        "bg-background border-accent flex h-full w-full flex-col overflow-hidden rounded-xl border",
        className,
      )}
    >
      {/* Header */}
      <div className="border-accent/60 flex items-center justify-between border-b px-4 py-3">
        <div className="flex flex-col">
          <div className="text-sm font-semibold">Room chat</div>
          <div className="text-muted-foreground text-xs">
            {connected ? "Connected" : "Reconnecting…"}
          </div>
        </div>
        <div className="text-muted-foreground text-xs">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollerRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "14px 14px",
        }}
      >
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No messages yet. Say hi.
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = m.senderId === playerId;
          const sender = playersById.get(m.senderId);
          const senderName = sender?.name ?? "Unknown";
          const senderRgb = twColor500ToRgb(sender?.color ?? "");

          return (
            <div
              key={m.id}
              className={cn(
                "flex w-full",
                mine ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-1",
                  mine
                    ? "border border-emerald-500/20 bg-emerald-600/20"
                    : [
                        // Use the sender's assigned color for a subtle border + tint.
                        "border",
                        "bg-[rgb(var(--sender-rgb)/0.10)]",
                        "border-[rgb(var(--sender-rgb)/0.35)]",
                      ],
                )}
                style={
                  mine
                    ? undefined
                    : ({ "--sender-rgb": senderRgb } as React.CSSProperties)
                }
              >
                {!mine ? (
                  <div
                    className="mb-0.5 text-[11px] font-medium text-[rgb(var(--sender-rgb)/0.9)]"
                  >
                    {senderName}
                  </div>
                ) : null}
                <div className="text-sm wrap-break-word whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-accent/60 flex items-end gap-2 border-t p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={connected ? "Message…" : "Connecting…"}
          disabled={!connected}
          rows={1}
          className="border-input bg-background focus-visible:ring-ring flex-1 resize-none rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!connected || !draft.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground inline-flex h-10 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
