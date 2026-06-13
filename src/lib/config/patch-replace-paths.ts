type JsonRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function formatConfigPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

function isObjectWithStringId(value: unknown): value is JsonRecord & { id: string } {
  return isPlainObject(value) && typeof value.id === "string" && value.id.length > 0;
}

function isIdKeyedArray(value: unknown[]): value is Array<JsonRecord & { id: string }> {
  return value.every(isObjectWithStringId);
}

function hasSameJsonShape(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function idKeyedArrayPreservesBaseIdsAndOrder(
  base: Array<JsonRecord & { id: string }>,
  merged: unknown[],
): boolean {
  const mergedIds = merged.filter(isObjectWithStringId).map((entry) => entry.id);
  let searchFromIndex = 0;

  for (const entry of base) {
    const matchIndex = mergedIds.indexOf(entry.id, searchFromIndex);
    if (matchIndex === -1) {
      return false;
    }
    searchFromIndex = matchIndex + 1;
  }

  return true;
}

function arrayPreservesBaseEntries(base: unknown[], merged: unknown[]): boolean {
  const unmatchedMerged = [...merged];

  for (const baseEntry of base) {
    const matchIndex = unmatchedMerged.findIndex((mergedEntry) =>
      hasSameJsonShape(mergedEntry, baseEntry),
    );
    if (matchIndex === -1) {
      return false;
    }
    unmatchedMerged.splice(matchIndex, 1);
  }

  return true;
}

function collectBaseArrayPaths(base: unknown, path: string): string[] {
  if (Array.isArray(base)) {
    return [path];
  }

  if (!isPlainObject(base)) {
    return [];
  }

  const paths: string[] = [];
  for (const [key, value] of Object.entries(base)) {
    paths.push(...collectBaseArrayPaths(value, formatConfigPath(path, key)));
  }
  return paths;
}

function collectDestructiveIdKeyedArrayEntryPatchPaths(params: {
  base: unknown[];
  patch: unknown[];
  merged: unknown[];
  path: string;
}): string[] {
  if (!isIdKeyedArray(params.base)) {
    return [];
  }

  const baseById = new Map(params.base.map((entry) => [entry.id, entry]));
  const mergedById = new Map(
    params.merged.filter(isObjectWithStringId).map((entry) => [entry.id, entry]),
  );
  const paths: string[] = [];

  for (const patchEntry of params.patch) {
    if (!isObjectWithStringId(patchEntry)) {
      continue;
    }

    const baseEntry = baseById.get(patchEntry.id);
    const mergedEntry = mergedById.get(patchEntry.id);
    if (!baseEntry || !mergedEntry) {
      continue;
    }

    paths.push(
      ...collectDestructiveArrayPatchPaths({
        base: baseEntry,
        patch: patchEntry,
        merged: mergedEntry,
        path: `${params.path}[]`,
      }),
    );
    paths.push(
      ...collectDestructiveMergedArrayPaths({
        base: baseEntry,
        merged: mergedEntry,
        path: `${params.path}[]`,
      }),
    );
  }

  return paths;
}

function collectDestructiveMergedArrayPaths(params: {
  base: unknown;
  merged: unknown;
  path: string;
}): string[] {
  if (Array.isArray(params.base)) {
    if (!Array.isArray(params.merged)) {
      return [params.path];
    }

    if (isIdKeyedArray(params.base)) {
      if (!idKeyedArrayPreservesBaseIdsAndOrder(params.base, params.merged)) {
        return [params.path];
      }

      return collectDestructiveIdKeyedArrayEntryMergedPaths({
        base: params.base,
        merged: params.merged,
        path: params.path,
      });
    }

    return arrayPreservesBaseEntries(params.base, params.merged) ? [] : [params.path];
  }

  if (!isPlainObject(params.base)) {
    return [];
  }

  const merged = isPlainObject(params.merged) ? params.merged : {};
  const paths: string[] = [];
  for (const [key, baseValue] of Object.entries(params.base)) {
    paths.push(
      ...collectDestructiveMergedArrayPaths({
        base: baseValue,
        merged: merged[key],
        path: formatConfigPath(params.path, key),
      }),
    );
  }
  return paths;
}

function collectDestructiveIdKeyedArrayEntryMergedPaths(params: {
  base: Array<JsonRecord & { id: string }>;
  merged: unknown[];
  path: string;
}): string[] {
  const mergedById = new Map(
    params.merged.filter(isObjectWithStringId).map((entry) => [entry.id, entry]),
  );
  const paths: string[] = [];

  for (const baseEntry of params.base) {
    const mergedEntry = mergedById.get(baseEntry.id);
    if (!mergedEntry) {
      continue;
    }

    paths.push(
      ...collectDestructiveMergedArrayPaths({
        base: baseEntry,
        merged: mergedEntry,
        path: `${params.path}[]`,
      }),
    );
  }

  return paths;
}

function collectDestructiveArrayPatchPaths(params: {
  base: unknown;
  patch: unknown;
  merged: unknown;
  path?: string;
}): string[] {
  if (!isPlainObject(params.patch) || !isPlainObject(params.base)) {
    return [];
  }

  const merged = isPlainObject(params.merged) ? params.merged : {};
  const paths: string[] = [];

  for (const [key, patchValue] of Object.entries(params.patch)) {
    const path = formatConfigPath(params.path ?? "", key);
    const baseValue = params.base[key];
    const mergedValue = merged[key];

    if (Array.isArray(baseValue)) {
      if (patchValue === null || !Array.isArray(patchValue)) {
        paths.push(path);
        continue;
      }

      if (Array.isArray(mergedValue)) {
        if (isIdKeyedArray(baseValue)) {
          if (!idKeyedArrayPreservesBaseIdsAndOrder(baseValue, mergedValue)) {
            paths.push(path);
            continue;
          }

          paths.push(
            ...collectDestructiveIdKeyedArrayEntryPatchPaths({
              base: baseValue,
              patch: patchValue,
              merged: mergedValue,
              path,
            }),
          );
        } else if (!arrayPreservesBaseEntries(baseValue, mergedValue)) {
          paths.push(path);
          continue;
        }
      }
    } else if (isPlainObject(baseValue) && !isPlainObject(patchValue)) {
      paths.push(...collectBaseArrayPaths(baseValue, path));
      continue;
    }

    if (isPlainObject(patchValue)) {
      paths.push(
        ...collectDestructiveArrayPatchPaths({
          base: baseValue,
          patch: patchValue,
          merged: mergedValue,
          path,
        }),
      );
    }
  }

  return paths;
}

export function getConfigPatchReplacePaths(params: {
  original: Record<string, unknown>;
  patch: Record<string, unknown>;
  draft: Record<string, unknown>;
}): string[] {
  return Array.from(
    new Set(
      collectDestructiveArrayPatchPaths({
        base: params.original,
        patch: params.patch,
        merged: params.draft,
      }),
    ),
  ).sort();
}
