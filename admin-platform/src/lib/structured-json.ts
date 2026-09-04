export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneJson<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

export function parseJsonObject(raw: string): { value?: JsonObject; error?: string } {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isJsonObject(value)) return { error: "Enter a JSON object with { } at the root." };
    return { value };
  } catch (error) {
    return { error: error instanceof SyntaxError ? error.message : "Enter valid JSON." };
  }
}

export function setObjectKeys(source: JsonObject, updates: Record<string, JsonValue>): JsonObject {
  return { ...cloneJson(source), ...updates };
}

export function updateAtPath(root: JsonValue, path: (string | number)[], value: JsonValue): JsonValue {
  if (!path.length) return value;
  const [head, ...tail] = path;
  const copy: JsonObject | JsonValue[] = Array.isArray(root) ? [...root] : { ...(isJsonObject(root) ? root : {}) };
  const current = copy[head as never] as JsonValue | undefined;
  copy[head as never] = updateAtPath(current ?? (typeof tail[0] === "number" ? [] : {}), tail, value) as never;
  return copy;
}

export function removeAtPath(root: JsonValue, path: (string | number)[]): JsonValue {
  const [head, ...tail] = path;
  const copy: JsonObject | JsonValue[] = Array.isArray(root) ? [...root] : { ...(isJsonObject(root) ? root : {}) };
  if (!tail.length) {
    if (Array.isArray(copy)) copy.splice(Number(head), 1);
    else delete copy[String(head)];
  } else copy[head as never] = removeAtPath(copy[head as never] as JsonValue, tail) as never;
  return copy;
}

export function moveArrayItem(root: JsonValue, path: (string | number)[], from: number, to: number): JsonValue {
  const target = path.reduce<JsonValue>((value, key) => (value as JsonObject | JsonValue[])[key as never], root);
  if (!Array.isArray(target) || to < 0 || to >= target.length) return root;
  const moved = [...target];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  return updateAtPath(root, path, moved);
}

export function moveObjectKey(root: JsonValue, path: (string | number)[], from: number, to: number): JsonValue {
  const target = path.reduce<JsonValue>((value, key) => (value as JsonObject | JsonValue[])[key as never], root);
  if (!isJsonObject(target) || to < 0 || to >= Object.keys(target).length) return root;
  const entries = Object.entries(target); const [entry] = entries.splice(from, 1); entries.splice(to, 0, entry);
  return updateAtPath(root, path, Object.fromEntries(entries));
}

export function defaultForType(type: string): JsonValue {
  if (type === "object") return {};
  if (type === "array") return [];
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "null") return null;
  return "";
}

export function jsonType(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
