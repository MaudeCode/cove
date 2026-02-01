/**
 * PasswordInput Component
 *
 * Input with visibility toggle for passwords/tokens.
 */

import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { forwardRef } from "preact/compat";
import { Eye, EyeOff } from "lucide-preact";
import { Input, type InputSize } from "./Input";

export interface PasswordInputProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> {
  /** Input size */
  size?: InputSize;
  /** Error message */
  error?: string;
  /** Full width */
  fullWidth?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ size = "md", error, fullWidth, class: className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    const toggleButton = (
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        class="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
      </button>
    );

    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        size={size}
        error={error}
        fullWidth={fullWidth}
        rightElement={toggleButton}
        class={className}
        {...props}
      />
    );
  },
);

PasswordInput.displayName = "PasswordInput";
