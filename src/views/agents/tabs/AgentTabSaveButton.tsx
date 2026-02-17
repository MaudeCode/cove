import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";

interface AgentTabSaveButtonProps {
  onClick: () => void;
  saving: boolean;
}

export function AgentTabSaveButton({ onClick, saving }: AgentTabSaveButtonProps) {
  return (
    <Button type="button" onClick={onClick} variant="primary" size="sm" disabled={saving}>
      {saving ? t("common.saving") : t("actions.save")}
    </Button>
  );
}
