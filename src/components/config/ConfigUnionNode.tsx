/**
 * ConfigUnionNode
 *
 * Renders anyOf/oneOf schema nodes.
 */

import { Dropdown } from "@/components/ui/Dropdown";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { updateField } from "@/signals/config";
import { humanize } from "@/lib/config/schema-utils";
import { ConfigNode } from "./ConfigNode";
import { SettingRow, JsonEditor } from "./ConfigFieldHelpers";

interface UnionNodeProps {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
  showLabel?: boolean;
}

export function UnionNode({
  schema,
  value,
  path,
  hints,
  level,
  label,
  help,
  showLabel,
}: UnionNodeProps) {
  const variants = schema.anyOf ?? schema.oneOf ?? [];
  const nonNull = variants.filter(
    (v) => v.type !== "null" && !(Array.isArray(v.type) && v.type.includes("null")),
  );

  // Single non-null variant - just render it
  if (nonNull.length === 1) {
    return (
      <ConfigNode
        schema={nonNull[0]}
        value={value}
        path={path}
        hints={hints}
        level={level}
        showLabel={showLabel}
      />
    );
  }

  // Check if it's enum-like (all const values)
  const literals = nonNull
    .map((v) => v.const ?? (v.enum?.length === 1 ? v.enum[0] : undefined))
    .filter((v) => v !== undefined);

  if (literals.length === nonNull.length && literals.length > 0) {
    const options = nonNull.map((v, i) => ({
      value: String(literals[i]),
      label: v.title ?? humanize(String(literals[i])),
    }));

    return (
      <SettingRow
        label={showLabel !== false ? label : undefined}
        description={help}
        inline={showLabel !== false}
      >
        <Dropdown
          value={String(value ?? "")}
          options={options}
          onChange={(v) => updateField(path, v)}
          size="sm"
          width="160px"
        />
      </SettingRow>
    );
  }

  // Complex union - fall back to JSON
  return (
    <SettingRow label={showLabel !== false ? label : undefined} description={help}>
      <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
    </SettingRow>
  );
}
