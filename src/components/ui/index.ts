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
export { LinkButton } from "./LinkButton";

// Form controls
export { Input, type InputProps, type InputSize } from "./Input";
export { PasswordInput, type PasswordInputProps } from "./PasswordInput";
export { DatePicker } from "./DatePicker";
export { Dropdown, type DropdownProps, type DropdownOption, type DropdownSize } from "./Dropdown";
export { ThemePicker } from "./ThemePicker";
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
export { ResizeHandle, type ResizeHandleProps } from "./ResizeHandle";

// Feedback
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { Badge, type BadgeProps, type BadgeVariant, type BadgeSize } from "./Badge";
export { Chip, type ChipProps, type ChipSize } from "./Chip";
// Skeleton components removed - not currently used
export { BouncingDots, type BouncingDotsProps } from "./BouncingDots";
export { StatusIcon } from "./StatusIcon";
export { HintBox } from "./HintBox";

// Branding
export { CoveLogo } from "./CoveLogo";

// Overlays
export { Modal, type ModalProps, type ModalSize } from "./Modal";
export { Tooltip, TooltipProvider, type TooltipProps, type TooltipPlacement } from "./Tooltip";
export {
  Toast,
  ToastContainer,
  showToast,
  dismissToast,
  toast,
  toasts,
  type ToastProps,
  type ToastData,
  type ToastType,
  type ToastPosition,
  type ToastContainerProps,
} from "./Toast";

// Error handling
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";

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
  MoreIcon,
  EditIcon,
  TrashIcon,
  FilterIcon,
  PinIcon,
  SearchIcon,
  ClockIcon,
  XIcon,
} from "./icons";
