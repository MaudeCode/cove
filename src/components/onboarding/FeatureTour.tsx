/**
 * FeatureTour
 *
 * Post-connection feature highlights walkthrough.
 * Skippable at any time.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { Button, Card, LinkButton } from "@/components/ui";
import { WizardProgress } from "./WizardProgress";
import { Palette, Keyboard, MessageSquare, Upload, ArrowRight, ArrowLeft } from "lucide-preact";

interface FeatureTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOUR_STEPS = ["themes", "shortcuts", "sessions", "uploads"] as const;
type TourStep = (typeof TOUR_STEPS)[number];

interface FeatureSlide {
  icon: preact.ComponentChildren;
  titleKey: string;
  descKey: string;
  tips: string[];
}

const slides: Record<TourStep, FeatureSlide> = {
  themes: {
    icon: <Palette class="w-12 h-12" />,
    titleKey: "tour.themesTitle",
    descKey: "tour.themesDesc",
    tips: ["tour.themesTip1", "tour.themesTip2", "tour.themesTip3"],
  },
  shortcuts: {
    icon: <Keyboard class="w-12 h-12" />,
    titleKey: "tour.shortcutsTitle",
    descKey: "tour.shortcutsDesc",
    tips: ["tour.shortcutsTip1", "tour.shortcutsTip2", "tour.shortcutsTip3"],
  },
  sessions: {
    icon: <MessageSquare class="w-12 h-12" />,
    titleKey: "tour.sessionsTitle",
    descKey: "tour.sessionsDesc",
    tips: ["tour.sessionsTip1", "tour.sessionsTip2", "tour.sessionsTip3"],
  },
  uploads: {
    icon: <Upload class="w-12 h-12" />,
    titleKey: "tour.uploadsTitle",
    descKey: "tour.uploadsDesc",
    tips: ["tour.uploadsTip1", "tour.uploadsTip2", "tour.uploadsTip3"],
  },
};

export function FeatureTour({ onComplete, onSkip }: FeatureTourProps) {
  const currentStep = useSignal<TourStep>("themes");
  const currentIndex = TOUR_STEPS.indexOf(currentStep.value);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOUR_STEPS.length - 1;
  const slide = slides[currentStep.value];

  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      currentStep.value = TOUR_STEPS[currentIndex + 1];
    }
  };

  const goBack = () => {
    if (!isFirst) {
      currentStep.value = TOUR_STEPS[currentIndex - 1];
    }
  };

  return (
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-md">
        <WizardProgress steps={TOUR_STEPS} current={currentStep.value} class="mb-8" />

        <Card variant="elevated" padding="lg" class="text-center">
          {/* Icon */}
          <div class="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center mx-auto mb-6">
            {slide.icon}
          </div>

          {/* Title & Description */}
          <h2 class="text-xl font-semibold mb-2">{t(slide.titleKey)}</h2>
          <p class="text-sm text-[var(--color-text-muted)] mb-6">{t(slide.descKey)}</p>

          {/* Tips */}
          <div class="text-left space-y-2 mb-8">
            {slide.tips.map((tipKey, i) => (
              <div key={i} class="flex items-start gap-2 text-sm">
                <span class="text-[var(--color-accent)] font-medium">•</span>
                <span class="text-[var(--color-text-secondary)]">{t(tipKey)}</span>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div class="flex gap-3">
            {!isFirst && (
              <Button variant="ghost" onClick={goBack} icon={<ArrowLeft class="w-4 h-4" />}>
                {t("actions.back")}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={goNext}
              class="flex-1"
              iconRight={<ArrowRight class="w-4 h-4" />}
            >
              {isLast ? t("tour.startChatting") : t("actions.next")}
            </Button>
          </div>

          {/* Skip link */}
          <div class="mt-4">
            <LinkButton onClick={onSkip}>{t("tour.skipTour")}</LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
