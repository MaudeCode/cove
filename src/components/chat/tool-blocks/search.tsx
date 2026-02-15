/**
 * Search input block (shared by web_search and memory_search)
 */

import { t } from "@/lib/i18n";
import { ToolInputContainer } from "./shared";

interface SearchInputBlockProps {
  args: Record<string, unknown>;
}

export function SearchInputBlock({ args }: SearchInputBlockProps) {
  const query = args.query as string;

  return (
    <ToolInputContainer>
      <span class="sr-only">{t("toolInput.searchQuery")}: </span>🔍 {query}
    </ToolInputContainer>
  );
}
