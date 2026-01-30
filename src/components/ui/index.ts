/**
 * UI Components
 *
 * Reusable UI primitives.
 */

// Buttons
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonSize,
  type IconButtonVariant,
} from "./IconButton";

// Form controls
export { Input, type InputProps, type InputSize } from "./Input";
export { Select, type SelectProps, type SelectOption, type SelectSize } from "./Select";
export { Toggle, type ToggleProps, type ToggleSize } from "./Toggle";
export { Checkbox, type CheckboxProps, type CheckboxSize } from "./Checkbox";
export { FormField, type FormFieldProps } from "./FormField";

// Layout
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
  type CardVariant,
  type CardPadding,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
} from "./Card";

// Feedback
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { Badge, type BadgeProps, type BadgeVariant, type BadgeSize } from "./Badge";
export { Skeleton, SkeletonText, SkeletonAvatar, type SkeletonProps } from "./Skeleton";

// Overlays
export { Modal, type ModalProps, type ModalSize } from "./Modal";
export {
  Toast,
  ToastContainer,
  showToast,
  dismissToast,
  clearToasts,
  toast,
  toasts,
  type ToastProps,
  type ToastData,
  type ToastType,
  type ToastPosition,
  type ToastContainerProps,
} from "./Toast";

// Error handling
export {
  ErrorBoundary,
  InlineError,
  type ErrorBoundaryProps,
  type InlineErrorProps,
} from "./ErrorBoundary";

// Icons (shared)
export {
  CloseIcon,
  PlusIcon,
  MenuIcon,
  SettingsIcon,
  LogoutIcon,
  ChevronDownIcon,
  ArrowDownIcon,
  ExternalLinkIcon,
  SendIcon,
  StopIcon,
} from "./icons";
