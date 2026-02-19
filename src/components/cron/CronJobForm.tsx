/**
 * CronJobForm
 *
 * Form for creating/editing cron jobs.
 */

import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { getTimeZoneSuggestions } from "@/lib/timezones";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { Disclosure } from "@/components/ui/Disclosure";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { Toggle } from "@/components/ui/Toggle";
import { ChipButtonGroup } from "@/components/ui/ChipButton";
import { Maximize2 } from "lucide-preact";
import {
  msToDatetimeLocal,
  datetimeLocalToMs,
  INTERVAL_PRESETS,
  CRON_EXAMPLES,
} from "./cron-helpers";

interface CronJobFormProps {
  // Form signals
  editName: Signal<string>;
  editDescription: Signal<string>;
  editScheduleKind: Signal<"cron" | "every" | "at">;
  editScheduleExpr: Signal<string>;
  editScheduleTz: Signal<string>;
  editScheduleStaggerMs: Signal<string>;
  editScheduleEveryMs: Signal<string>;
  editScheduleAtMs: Signal<string>;
  editSessionTarget: Signal<"main" | "isolated">;
  editWakeMode: Signal<"next-heartbeat" | "now">;
  editDeliveryAnnounce: Signal<boolean>;
  editPayloadText: Signal<string>;
  editPayloadMessage: Signal<string>;
  editPayloadModel: Signal<string>;
  formErrors: Signal<Record<string, string>>;
}

const SCHEDULE_KIND_OPTIONS = [
  { value: "cron", label: t("cron.scheduleKind.cron") },
  { value: "every", label: t("cron.scheduleKind.every") },
  { value: "at", label: t("cron.scheduleKind.at") },
];

const SESSION_TARGET_OPTIONS = [
  { value: "main", label: t("cron.sessionTarget.main") },
  { value: "isolated", label: t("cron.sessionTarget.isolated") },
];

const WAKE_MODE_OPTIONS = [
  { value: "next-heartbeat", label: t("cron.wakeMode.nextHeartbeat") },
  { value: "now", label: t("cron.wakeMode.now") },
];

export function CronJobForm({
  editName,
  editDescription,
  editScheduleKind,
  editScheduleExpr,
  editScheduleTz,
  editScheduleStaggerMs,
  editScheduleEveryMs,
  editScheduleAtMs,
  editSessionTarget,
  editWakeMode,
  editDeliveryAnnounce,
  editPayloadText,
  editPayloadMessage,
  editPayloadModel,
  formErrors,
}: CronJobFormProps) {
  const errors = formErrors.value;
  const showAdvancedScheduleOptions = useSignal(false);
  const showPayloadFullscreenEditor = useSignal(false);
  const timeZoneQuery = editScheduleTz.value.trim();
  const timeZoneSuggestions = getTimeZoneSuggestions(timeZoneQuery, 8);

  const setActivePayloadValue = (value: string) => {
    if (editSessionTarget.value === "main") {
      editPayloadText.value = value;
      return;
    }
    editPayloadMessage.value = value;
  };

  const activePayloadValue =
    editSessionTarget.value === "main" ? editPayloadText.value : editPayloadMessage.value;
  const activePayloadPlaceholder =
    editSessionTarget.value === "main"
      ? t("cron.form.systemEventPlaceholder")
      : t("cron.form.agentMessagePlaceholder");

  useEffect(() => {
    if (editScheduleKind.value !== "cron") {
      showAdvancedScheduleOptions.value = false;
      return;
    }
    if (editScheduleStaggerMs.value.trim()) {
      showAdvancedScheduleOptions.value = true;
    }
  }, [editScheduleKind.value, editScheduleStaggerMs.value]);

  return (
    <div class="space-y-4 sm:space-y-5">
      {/* Name */}
      <FormField label={t("common.name")} error={errors.name}>
        <Input
          value={editName.value}
          onInput={(e) => (editName.value = (e.target as HTMLInputElement).value)}
          placeholder={t("cron.form.namePlaceholder")}
          error={!!errors.name}
          fullWidth
        />
      </FormField>

      <FormField label={t("cron.form.description")} hint={t("cron.form.descriptionHint")}>
        <Input
          value={editDescription.value}
          onInput={(e) => (editDescription.value = (e.target as HTMLInputElement).value)}
          placeholder={t("cron.form.descriptionPlaceholder")}
          fullWidth
        />
      </FormField>

      {/* Schedule */}
      <FormField label={t("common.schedule")} error={errors.schedule}>
        <div class="space-y-3">
          <Dropdown
            value={editScheduleKind.value}
            onChange={(val) => (editScheduleKind.value = val as "cron" | "every" | "at")}
            options={SCHEDULE_KIND_OPTIONS}
          />
          {editScheduleKind.value === "cron" && (
            <div class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={editScheduleExpr.value}
                  onInput={(e) => (editScheduleExpr.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("cron.form.cronPlaceholder")}
                  fullWidth
                />
                <AutocompleteInput
                  value={editScheduleTz.value}
                  onValueChange={(val) => (editScheduleTz.value = val)}
                  suggestions={timeZoneSuggestions}
                  placeholder={t("cron.form.timezonePlaceholder")}
                  aria-label={t("cron.form.timezone")}
                  minCharsToOpen={0}
                  clearable
                  clearAriaLabel={t("actions.clear")}
                  fullWidth
                />
              </div>
              <p class="text-xs text-[var(--color-text-muted)]">{t("cron.form.timezoneHint")}</p>
              <ChipButtonGroup
                options={CRON_EXAMPLES.map(({ expr, label }) => ({ value: expr, label }))}
                value={editScheduleExpr.value}
                onChange={(expr) => (editScheduleExpr.value = expr)}
                size="sm"
              />
              <Disclosure
                isOpen={showAdvancedScheduleOptions.value}
                onToggle={(nextOpen) => (showAdvancedScheduleOptions.value = nextOpen)}
                collapsedLabel={t("cron.form.showAdvanced")}
                expandedLabel={t("cron.form.hideAdvanced")}
                contentClass="mt-2"
              >
                <FormField label={t("cron.form.staggerMs")} hint={t("cron.form.staggerMsHint")}>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={editScheduleStaggerMs.value}
                    onInput={(e) =>
                      (editScheduleStaggerMs.value = (e.target as HTMLInputElement).value)
                    }
                    placeholder={t("cron.form.staggerMsPlaceholder")}
                    fullWidth
                  />
                </FormField>
              </Disclosure>
            </div>
          )}
          {editScheduleKind.value === "every" && (
            <div class="space-y-2">
              <ChipButtonGroup
                options={INTERVAL_PRESETS.map(({ ms, label }) => ({ value: String(ms), label }))}
                value={editScheduleEveryMs.value}
                onChange={(val) => (editScheduleEveryMs.value = val)}
              />
              <Input
                type="number"
                value={editScheduleEveryMs.value}
                onInput={(e) => (editScheduleEveryMs.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.form.intervalPlaceholder")}
                fullWidth
              />
            </div>
          )}
          {editScheduleKind.value === "at" && (
            <Input
              type="datetime-local"
              value={msToDatetimeLocal(Number(editScheduleAtMs.value) || Date.now())}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                editScheduleAtMs.value = String(datetimeLocalToMs(val));
              }}
              fullWidth
            />
          )}
        </div>
      </FormField>

      {/* Session Target & Wake Mode */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <FormField label={t("cron.form.sessionTarget")} hint={t("cron.form.sessionTargetHint")}>
          <Dropdown
            value={editSessionTarget.value}
            onChange={(val) => {
              editSessionTarget.value = val as "main" | "isolated";
            }}
            options={SESSION_TARGET_OPTIONS}
          />
        </FormField>
        <FormField label={t("cron.form.wakeMode")} hint={t("cron.form.wakeModeHint")}>
          <Dropdown
            value={editWakeMode.value}
            onChange={(val) => (editWakeMode.value = val as "next-heartbeat" | "now")}
            options={WAKE_MODE_OPTIONS}
          />
        </FormField>
      </div>

      {/* Announce Results (isolated only) */}
      {editSessionTarget.value === "isolated" && (
        <div class="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <div>
            <div class="text-sm font-medium">{t("cron.form.announceResults")}</div>
            <div class="text-xs text-[var(--color-text-muted)]">
              {t("cron.form.announceResultsHint")}
            </div>
          </div>
          <Toggle
            checked={editDeliveryAnnounce.value}
            onChange={(checked) => (editDeliveryAnnounce.value = checked)}
            label={t("cron.form.announceResults")}
          />
        </div>
      )}

      {/* Payload */}
      <FormField
        label={t("cron.form.payload")}
        labelAction={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<Maximize2 class="w-4 h-4" />}
            onClick={() => (showPayloadFullscreenEditor.value = true)}
            class="sm:hidden"
          >
            {t("cron.form.expandPayloadEditor")}
          </Button>
        }
        error={errors.payload}
        hint={
          editSessionTarget.value === "main"
            ? t("cron.form.payloadHintMain")
            : t("cron.form.payloadHintIsolated")
        }
      >
        {editSessionTarget.value === "main" ? (
          <Textarea
            value={editPayloadText.value}
            onInput={(e) => (editPayloadText.value = (e.target as HTMLTextAreaElement).value)}
            placeholder={t("cron.form.systemEventPlaceholder")}
            error={!!errors.payload}
            rows={3}
            fullWidth
          />
        ) : (
          <div class="space-y-3">
            <Textarea
              value={editPayloadMessage.value}
              onInput={(e) => (editPayloadMessage.value = (e.target as HTMLTextAreaElement).value)}
              placeholder={t("cron.form.agentMessagePlaceholder")}
              error={!!errors.payload}
              rows={3}
              fullWidth
            />
            <Input
              value={editPayloadModel.value}
              onInput={(e) => (editPayloadModel.value = (e.target as HTMLInputElement).value)}
              placeholder={t("cron.form.modelPlaceholder")}
              fullWidth
            />
          </div>
        )}
      </FormField>

      {showPayloadFullscreenEditor.value && (
        <div class="fixed inset-0 z-[60] sm:hidden bg-[var(--color-bg-surface)] flex flex-col">
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <h4 class="text-base font-semibold text-[var(--color-text-primary)]">
              {t("cron.form.fullscreenPayloadTitle")}
            </h4>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => (showPayloadFullscreenEditor.value = false)}
            >
              {t("actions.done")}
            </Button>
          </div>
          <div class="flex-1 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] overflow-y-auto">
            <Textarea
              value={activePayloadValue}
              onInput={(e) => setActivePayloadValue((e.target as HTMLTextAreaElement).value)}
              placeholder={activePayloadPlaceholder}
              error={!!errors.payload}
              rows={12}
              fullWidth
              class="min-h-[60vh] h-full resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
