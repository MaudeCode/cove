/**
 * Tour Steps Configuration
 *
 * Defines the spotlight tour steps and their targets.
 * Different steps for single-chat vs multi-chat modes.
 */

import { route } from "preact-router";
import type { TourStep } from "@/components/tour/SpotlightTour";
import { t } from "@/lib/i18n";
import { canvasNodeEnabled } from "@/signals/settings";
import { nodePairingStatus, nodeConnected } from "@/lib/node-connection";

/** Steps that only apply in multi-chat mode */
function getMultiChatSteps(): TourStep[] {
  return [
    {
      target: "[data-tour='sessions']",
      title: t("tour.steps.sessions.title"),
      content: t("tour.steps.sessions.content"),
      placement: "right",
    },
  ];
}

/** Steps shared between both modes */
function getCommonSteps(): TourStep[] {
  return [
    {
      target: "[data-tour='chat-input']",
      title: t("tour.steps.chatInput.title"),
      content: t("tour.steps.chatInput.content"),
      placement: "top",
    },
    {
      target: "[data-tour='model-picker']",
      title: t("tour.steps.modelPicker.title"),
      content: t("tour.steps.modelPicker.content"),
      placement: "top",
    },
    {
      target: "[data-tour='settings']",
      title: t("common.settings"),
      content: t("tour.steps.settings.content"),
      placement: "bottom",
    },
  ];
}

/** Canvas pairing step - navigate to devices to approve */
function getCanvasPairingStep(): TourStep {
  return {
    target: "[data-tour='pending-requests']",
    title: t("tour.steps.canvasPairing.title"),
    content: t("tour.steps.canvasPairing.content"),
    placement: "bottom",
    beforeShow: async () => {
      route("/devices");
      // Wait for navigation and DOM update
      await new Promise((r) => setTimeout(r, 500));
    },
    autoAdvanceWhen: () => nodePairingStatus.value === "paired",
  };
}

/** Canvas button step - shown after pairing is complete */
function getCanvasButtonStep(): TourStep {
  return {
    target: "[data-tour='canvas']",
    title: t("common.canvas"),
    content: t("tour.steps.canvasButton.content"),
    placement: "bottom",
    beforeShow: async () => {
      route("/");
      // Wait for route change and canvas button to render
      // Button shows when canvasNodeEnabled is true (which it must be to reach this step)
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (document.querySelector("[data-tour='canvas']")) {
          return;
        }
      }
    },
  };
}

/**
 * Get the appropriate tour steps based on app mode and settings.
 * NOTE: This is called once at tour start - steps should not change during the tour.
 * Steps are built at call time to get current i18n translations.
 */
export function getTourSteps(mode: "single" | "multi"): TourStep[] {
  const baseSteps =
    mode === "multi" ? [...getMultiChatSteps(), ...getCommonSteps()] : getCommonSteps();

  // Add canvas steps if enabled
  if (canvasNodeEnabled.value) {
    // If already paired, just show canvas button step
    if (nodePairingStatus.value === "paired" && nodeConnected.value) {
      return [...baseSteps, getCanvasButtonStep()];
    }
    // Not yet paired - show pairing step, then canvas button
    return [...baseSteps, getCanvasPairingStep(), getCanvasButtonStep()];
  }

  return baseSteps;
}
