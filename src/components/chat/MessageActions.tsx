/**
 * MessageActions
 *
 * Dropdown menu for message actions (copy, etc.)
 * Appears on hover in the top-right corner of messages.
 */

import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { MoreVertical, Copy, FileText, Check } from "lucide-preact";
import { t } from "@/lib/i18n";
import { stripMarkdown } from "@/lib/utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { toast } from "@/components/ui/Toast";

// ============================================
// Constants
// ============================================

/** How long to show "Copied!" feedback (ms) */
const COPIED_FEEDBACK_MS = 2000;

// ============================================
// Types
// ============================================

interface MessageActionsProps {
  /** Raw markdown content */
  content: string;
  /** Whether the menu should be visible (controlled by parent hover state) */
  visible?: boolean;
}

type CopyType = "formatted" | "raw";

// ============================================
// Sub-components
// ============================================

interface MenuItemProps {
  icon: ComponentChildren;
  label: string;
  onClick: () => void;
}

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      class="
        w-full px-3 py-2 text-left text-sm
        flex items-center gap-2
        text-[var(--color-text-primary)]
        hover:bg-[var(--color-bg-hover)]
        transition-colors cursor-pointer
      "
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================
// Main Component
// ============================================

export function MessageActions({ content, visible = false }: MessageActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<CopyType | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useClickOutside([menuRef, buttonRef], () => setIsOpen(false), isOpen);

  // Reset copied state after delay
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  /**
   * Copy content and show feedback
   */
  const copyToClipboard = useCallback(
    async (type: CopyType) => {
      const text = type === "formatted" ? stripMarkdown(content) : content;
      const label = type === "formatted" ? t("actions.copy") : t("chat.copyMarkdown");

      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error("Clipboard API unavailable");
        }

        await navigator.clipboard.writeText(text);
        setCopied(type);
        setIsOpen(false);
      } catch {
        toast.error(t("status.copyFailed", { label }));
      }
    },
    [content],
  );

  /**
   * Get icon for menu item (checkmark if just copied)
   */
  const getIcon = (type: CopyType, DefaultIcon: typeof Copy) => {
    if (copied === type) {
      return <Check class="w-4 h-4 text-[var(--color-success)]" />;
    }
    return <DefaultIcon class="w-4 h-4 text-[var(--color-text-muted)]" />;
  };

  /**
   * Get label for menu item (shows "Copied!" feedback)
   */
  const getLabel = (type: CopyType, defaultLabel: string) => {
    return copied === type ? t("actions.copied") : defaultLabel;
  };

  return (
    <div class="relative">
      {/* Trigger button - always rendered, visibility controlled by opacity */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("actions.more")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        class={`
          p-1 rounded
          text-[var(--color-text-muted)]
          hover:text-[var(--color-text-secondary)]
          hover:bg-[var(--color-bg-hover)]
          transition-all cursor-pointer
          ${isOpen || visible ? "opacity-100" : "opacity-0"}
          ${isOpen ? "bg-[var(--color-bg-hover)]" : ""}
        `}
      >
        <MoreVertical class="w-4 h-4" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          class="
            absolute right-0 top-full mt-1 z-50
            min-w-[160px] py-1
            bg-[var(--color-bg-surface)]
            border border-[var(--color-border)]
            rounded-lg shadow-lg
          "
        >
          <MenuItem
            icon={getIcon("formatted", Copy)}
            label={getLabel("formatted", t("actions.copy"))}
            onClick={() => copyToClipboard("formatted")}
          />
          <MenuItem
            icon={getIcon("raw", FileText)}
            label={getLabel("raw", t("chat.copyMarkdown"))}
            onClick={() => copyToClipboard("raw")}
          />
        </div>
      )}
    </div>
  );
}
