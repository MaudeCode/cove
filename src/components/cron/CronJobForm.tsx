/**
 * CronJobForm
 *
 * Form for creating/editing cron jobs.
 */

import type { Signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { ChipButtonGroup } from "@/components/ui/ChipButton";
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
  editScheduleEveryMs: Signal<string>;
  editScheduleAtMs: Signal<string>;
  editSessionTarget: Signal<"main" | "isolated">;
  editWakeMode: Signal<"next-heartbeat" | "now">;
  editPayloadKind: Signal<"systemEvent" | "agentTurn">;
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
  editScheduleEveryMs,
  editScheduleAtMs,
  editSessionTarget,
  editWakeMode,
  editPayloadText,
  editPayloadMessage,
  editPayloadModel,
  formErrors,
}: CronJobFormProps) {
  const errors = formErrors.value;

  return (
    <div class="space-y-4 sm:space-y-5">
      {/* Name */}
      <FormField label={t("cron.form.name")} error={errors.name}>
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
      <FormField label={t("cron.form.schedule")} error={errors.schedule}>
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
                <Input
                  value={editScheduleTz.value}
                  onInput={(e) => (editScheduleTz.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("cron.form.timezonePlaceholder")}
                  fullWidth
                />
              </div>
              <ChipButtonGroup
                options={CRON_EXAMPLES.map(({ expr, label }) => ({ value: expr, label }))}
                value={editScheduleExpr.value}
                onChange={(expr) => (editScheduleExpr.value = expr)}
                size="sm"
              />
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

      {/* Payload */}
      <FormField
        label={t("cron.form.payload")}
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
    </div>
  );
}
