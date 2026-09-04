import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useState } from "react";
import { StructuredJsonEditor } from "./structured-json-editor";
import type { JsonObject } from "@/lib/structured-json";

afterEach(cleanup);

function Harness({ initial, onChange = () => undefined }: { initial: JsonObject; onChange?: (value: JsonObject) => void }) {
  const [value, setValue] = useState(initial);
  return <StructuredJsonEditor id="content" label="Content" value={value} onChange={next => { setValue(next); onChange(next); }} />;
}

describe("StructuredJsonEditor", () => {
  it("edits nested fields and supports collection operations", async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<Harness initial={{ nested: { title: "Original" }, items: ["a", "b"] }} onChange={onChange} />);
    await user.clear(screen.getByLabelText("title value")); await user.type(screen.getByLabelText("title value"), "Revised");
    expect(onChange).toHaveBeenLastCalledWith({ nested: { title: "Revised" }, items: ["a", "b"] });
    await user.click(screen.getByRole("button", { name: "Move items item 2 up" }));
    expect(onChange).toHaveBeenLastCalledWith({ nested: { title: "Revised" }, items: ["b", "a"] });
  });

  it("keeps invalid raw text until reset and applies a valid object", async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<Harness initial={{ keep: true }} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Advanced JSON" }));
    const raw = screen.getByLabelText("Content raw JSON"); fireEvent.change(raw, { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(screen.getByRole("alert")).toBeDefined(); expect((raw as HTMLTextAreaElement).value).toBe("{"); expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(raw, { target: { value: '{"next":2}' } }); await user.click(screen.getByRole("button", { name: "Apply JSON" }));
    expect(onChange).toHaveBeenCalledWith({ next: 2 });
  });

  it("rejects array roots and has no serious accessibility violations", async () => {
    const user = userEvent.setup(); const { container } = render(<Harness initial={{}} />);
    await user.click(screen.getByRole("button", { name: "Advanced JSON" })); fireEvent.change(screen.getByLabelText("Content raw JSON"), { target: { value: "[]" } });
    await user.click(screen.getByRole("button", { name: "Apply JSON" })); expect(screen.getByText(/object with/)).toBeDefined();
    expect((await axe(container)).violations.filter(issue => ["serious", "critical"].includes(issue.impact || ""))).toEqual([]);
  });
});
