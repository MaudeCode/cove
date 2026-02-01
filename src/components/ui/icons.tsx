/**
 * Shared Icons
 *
 * Re-exports lucide-preact icons with consistent naming.
 * For page-specific icons, see src/lib/navigation.tsx
 */

import {
  X,
  Plus,
  Menu,
  Settings,
  ChevronDown,
  ArrowDown,
  ExternalLink,
  Send,
  Square,
  MoreVertical,
  Pencil,
  Trash2,
  Filter,
  Pin,
  Search,
  Check,
} from "lucide-preact";

type IconProps = {
  class?: string;
};

// ============================================
// Action Icons
// ============================================

export function XIcon({ class: className }: IconProps) {
  return <X class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function PlusIcon({ class: className }: IconProps) {
  return <Plus class={className || "w-4 h-4"} aria-hidden="true" />;
}

export function MenuIcon({ class: className }: IconProps) {
  return <Menu class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function SettingsIcon({ class: className }: IconProps) {
  return <Settings class={className || "w-5 h-5"} aria-hidden="true" />;
}

// ============================================
// Directional Icons
// ============================================

export function ChevronDownIcon({ class: className, open }: IconProps & { open?: boolean }) {
  return (
    <ChevronDown
      class={`${className || "w-4 h-4"} transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    />
  );
}

export function ArrowDownIcon({ class: className }: IconProps) {
  return <ArrowDown class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function ExternalLinkIcon({ class: className }: IconProps) {
  return <ExternalLink class={className || "w-3 h-3"} aria-hidden="true" />;
}

// ============================================
// Media Icons
// ============================================

export function SendIcon({ class: className }: IconProps) {
  return <Send class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function StopIcon({ class: className }: IconProps) {
  return <Square class={className || "w-5 h-5"} fill="currentColor" aria-hidden="true" />;
}

export function MoreIcon({ class: className }: IconProps) {
  return <MoreVertical class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function EditIcon({ class: className }: IconProps) {
  return <Pencil class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function TrashIcon({ class: className }: IconProps) {
  return <Trash2 class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function FilterIcon({ class: className }: IconProps) {
  return <Filter class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function PinIcon({ class: className }: IconProps) {
  return <Pin class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function SearchIcon({ class: className }: IconProps) {
  return <Search class={className || "w-5 h-5"} aria-hidden="true" />;
}

export function CheckIcon({ class: className }: IconProps) {
  return <Check class={className || "w-5 h-5"} aria-hidden="true" />;
}
