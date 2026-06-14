/** @jsxImportSource preact */
import { mock } from "bun:test";
import type { ComponentChildren, JSX } from "preact";
import { useState } from "preact/hooks";

type DropdownOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ComponentChildren;
  label?: string;
  loading?: boolean;
};

type UiMockFactory = () => unknown;

export function MockBadge({ children }: { children?: ComponentChildren }) {
  return <span>{children}</span>;
}

export function MockButton({
  children,
  disabled,
  loading,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button {...props} disabled={disabled || loading} type={type}>
      {children}
    </button>
  );
}

export function MockCard({
  children,
  title,
  ...props
}: JSX.HTMLAttributes<HTMLElement> & { children?: ComponentChildren; title?: string }) {
  return (
    <section {...props} aria-label={title}>
      {children}
    </section>
  );
}

export function MockDropdown({
  "aria-label": ariaLabel,
  disabled,
  onChange,
  options,
  placeholder = "Select...",
  value,
}: {
  "aria-label"?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder;
  const selectOption = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };
  const handleKeyDown = (event: JSX.TargetedKeyboardEvent<Element>) => {
    if (!open) {
      if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(options[focusedIndex]);
    }
  };

  return (
    <div>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {label}
      </button>
      {open && (
        <div aria-label={ariaLabel} onKeyDown={handleKeyDown} role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option)}
              onMouseEnter={() => setFocusedIndex(options.indexOf(option))}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MockIconButton({ label, type = "button", ...props }: ButtonProps) {
  return (
    <button {...props} aria-label={label} type={type}>
      {label}
    </button>
  );
}

export function MockInput({
  "aria-label": ariaLabel,
  error,
  ...props
}: JSX.InputHTMLAttributes<HTMLInputElement> & {
  "aria-label"?: string;
  error?: string | boolean;
}) {
  const errorId = typeof error === "string" && error && props.id ? `${props.id}-error` : undefined;

  return (
    <>
      <input
        {...props}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        aria-label={ariaLabel}
      />
      {typeof error === "string" && error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function MockModal({
  children,
  open,
  title,
}: {
  children?: ComponentChildren;
  open: boolean;
  title?: string;
}) {
  return open ? (
    <section aria-label={title} role="dialog">
      {children}
    </section>
  ) : null;
}

export function MockPageHeader({
  actions,
  subtitle,
  title,
}: {
  actions?: ComponentChildren;
  subtitle?: ComponentChildren;
  title: string;
}) {
  return (
    <header>
      <h1>{title}</h1>
      {subtitle}
      {actions}
    </header>
  );
}

export function MockPageLayout({
  children,
  viewName,
}: {
  children?: ComponentChildren;
  viewName: string;
}) {
  return <main aria-label={viewName}>{children}</main>;
}

export function MockSpinner({ label }: { label?: string }) {
  return <div role="status">{label ?? "loading"}</div>;
}

export function MockTextarea({
  error,
  ...props
}: JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea {...props} aria-invalid={Boolean(error)} />;
}

export function MockToggle({
  checked,
  children,
  disabled,
  label,
  onChange,
  type = "button",
  ...props
}: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  checked: boolean;
  label?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      {...props}
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type={type}
    >
      {children ?? label}
    </button>
  );
}

export function installUiMocks(overrides: Record<string, UiMockFactory> = {}): void {
  const defaults: Record<string, UiMockFactory> = {
    "@/components/ui/Badge": () => ({ Badge: MockBadge }),
    "@/components/ui/Button": () => ({ Button: MockButton }),
    "@/components/ui/Card": () => ({ Card: MockCard }),
    "@/components/ui/Dropdown": () => ({ Dropdown: MockDropdown }),
    "@/components/ui/IconButton": () => ({ IconButton: MockIconButton }),
    "@/components/ui/Input": () => ({ Input: MockInput }),
    "@/components/ui/Modal": () => ({ Modal: MockModal }),
    "@/components/ui/PageHeader": () => ({ PageHeader: MockPageHeader }),
    "@/components/ui/PageLayout": () => ({ PageLayout: MockPageLayout }),
    "@/components/ui/Spinner": () => ({ Spinner: MockSpinner }),
    "@/components/ui/Textarea": () => ({ Textarea: MockTextarea }),
    "@/components/ui/Toggle": () => ({ Toggle: MockToggle }),
  };

  for (const [specifier, factory] of Object.entries({ ...defaults, ...overrides })) {
    mock.module(specifier, factory);
  }
}
