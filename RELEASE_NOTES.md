## 🔧 Gateway 2026.3 Compatibility

Updated to work with OpenClaw 2026.3.x gateway changes:

- **Cron schedule fix** — Handles the new ISO-8601 `at` field for one-time schedules (fixes crash on cron page)
- **Status field split** — Reads `lastRunStatus` with `lastStatus` fallback for correct job status display
- **New delivery modes** — Types updated for `webhook` delivery, failure destinations, and failure alerts

---

## 📊 Cron Run History

Richer details when reviewing cron job execution history:

- **Delivery status** — See whether job output was delivered, with status badges
- **Model & usage** — View which model ran and token counts per execution
- **Pagination** — Better handling of large job lists
