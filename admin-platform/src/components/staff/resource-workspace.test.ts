import { describe, expect, it } from "vitest";

import { serializeValues } from "./resource-workspace";
import type { StaffResourceDefinition } from "@/lib/staff/resources";

const definition: StaffResourceDefinition = {
  key: "example",
  section: "content",
  title: "Examples",
  singular: "example",
  description: "Test resource",
  endpoint: "examples",
  viewPermission: "example.view",
  fields: [
    {
      key: "program",
      label: "Program",
      type: "relation",
      required: true,
      relation: { endpoint: "programs", labelKeys: ["name"] },
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [{ label: "Draft", value: "DRAFT" }],
    },
  ],
  columns: [{ key: "program", label: "Program" }],
};

describe("resource form serialization", () => {
  it("blocks a missing required relation before calling the API", () => {
    const result = serializeValues(
      definition,
      { program: "", status: "DRAFT" },
      false,
    );

    expect(result.payload).toBeNull();
    expect(result.errors).toEqual({ program: "Program is required." });
  });

  it("does not accept the nullable sentinel for a required select", () => {
    const result = serializeValues(
      definition,
      { program: "program-1", status: "__none__" },
      false,
    );

    expect(result.payload).toBeNull();
    expect(result.errors).toEqual({ status: "Status is required." });
  });
});
