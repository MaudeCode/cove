import { useEffect } from "preact/hooks";
import type { Signal } from "@preact/signals";

interface UseExpandableFromQueryParamSetOptions<T extends string | number> {
  /** Gate sync until backing data is loaded */
  ready: boolean;
  /** Parsed query param set from useQueryParamSet */
  expandedParam: Signal<Set<T>>;
  /** Local expanded state signal */
  expandedState: Signal<Set<T>>;
  /** useQueryParamSet initialized signal */
  expandedInitialized: Signal<boolean>;
  /** Setter from useQueryParamSet */
  setExpandedParam: (set: Set<T>) => void;
  /** Optional validation/filter for URL-driven values */
  isValid?: (item: T) => boolean;
  /** Selector to scroll to the first new item */
  getItemSelector: (item: T) => string;
  /** Called on mobile for the first newly-expanded item */
  onMobileOpenFirst?: (item: T) => void;
  /** Mobile breakpoint check (defaults to md breakpoint) */
  isMobile?: () => boolean;
  /** Whether to scroll on mobile too */
  scrollOnMobile?: boolean;
  /** Scroll delay for mount/render timing */
  scrollDelayMs?: number;
}

function areSetsEqual<T>(left: Set<T>, right: Set<T>): boolean {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

/**
 * Shared URL <-> expanded set sync for views that support
 * deep-link expansion, mobile modal opening, and optional auto-scroll.
 */
export function useExpandableFromQueryParamSet<T extends string | number>(
  options: UseExpandableFromQueryParamSetOptions<T>,
): void {
  const {
    ready,
    expandedParam,
    expandedState,
    expandedInitialized,
    setExpandedParam,
    isValid,
    getItemSelector,
    onMobileOpenFirst,
    isMobile = () => window.matchMedia("(max-width: 767px)").matches,
    scrollOnMobile = true,
    scrollDelayMs = 100,
  } = options;

  useEffect(() => {
    if (!ready || expandedParam.value.size === 0) return;

    const allItems = Array.from(expandedParam.value).filter((item) =>
      isValid ? isValid(item) : true,
    );
    const newItems = allItems.filter((item) => !expandedState.value.has(item));
    if (newItems.length === 0) return;

    expandedState.value = new Set([...expandedState.value, ...allItems]);

    const mobile = isMobile();
    if (mobile && onMobileOpenFirst) {
      onMobileOpenFirst(newItems[0]);
    }

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    if (!mobile || scrollOnMobile) {
      scrollTimer = setTimeout(() => {
        const selector = getItemSelector(newItems[0]);
        const els = document.querySelectorAll(selector);
        const el = Array.from(els).find((e) => (e as HTMLElement).offsetParent !== null);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, scrollDelayMs);
    }

    return () => {
      if (scrollTimer !== undefined) {
        clearTimeout(scrollTimer);
      }
    };
  }, [expandedParam.value, ready]);

  useEffect(() => {
    if (expandedInitialized.value && !areSetsEqual(expandedParam.value, expandedState.value)) {
      setExpandedParam(expandedState.value);
    }
  }, [expandedParam.value, expandedState.value, expandedInitialized.value]);
}
