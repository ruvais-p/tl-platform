import { describe, expect, it } from "vitest";
import { cloneJson, defaultForType, moveArrayItem, moveObjectKey, parseJsonObject, removeAtPath, setObjectKeys, updateAtPath, type JsonObject } from "./structured-json";

describe("structured JSON helpers", () => {
  it("clones and updates every JSON value without mutating the source", () => {
    const source: JsonObject = { text: "a", number: 2, boolean: true, nil: null, list: [1, { deep: "yes" }] };
    const clone = cloneJson(source); const updated = updateAtPath(source, ["list", 1, "deep"], "changed");
    expect(clone).toEqual(source); expect(updated).not.toBe(source); expect(source.list).toEqual([1, { deep: "yes" }]);
    expect(updated).toEqual({ ...source, list: [1, { deep: "changed" }] });
  });
  it("validates object roots and syntax", () => {
    expect(parseJsonObject('{"ok":true}').value).toEqual({ ok: true });
    expect(parseJsonObject("[]").error).toMatch(/object/); expect(parseJsonObject("{").error).toBeTruthy();
  });
  it("preserves unknown keys when specialized fields change", () => {
    expect(setObjectKeys({ complete: false, unknown: { keep: [1, 2] } }, { complete: true })).toEqual({ complete: true, unknown: { keep: [1, 2] } });
  });
  it("removes and reorders collection values", () => {
    const source: JsonObject = { list: ["a", "b", "c"] };
    expect(moveArrayItem(source, ["list"], 2, 0)).toEqual({ list: ["c", "a", "b"] });
    expect(removeAtPath(source, ["list", 1])).toEqual({ list: ["a", "c"] });
    expect(Object.keys(moveObjectKey({ first: 1, second: 2 }, [], 1, 0) as JsonObject)).toEqual(["second", "first"]);
  });
  it("provides valid defaults for all supported types", () => {
    expect(["string", "number", "boolean", "null", "object", "array"].map(defaultForType)).toEqual(["", 0, false, null, {}, []]);
  });
});
