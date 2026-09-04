import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityCompletionEditor, ChapterCompletionEditor } from "./completion-rule-editor";

afterEach(cleanup);

describe("completion rule editors", () => {
  it("hydrates chapter rules and preserves unknown fields", async () => {
    const user = userEvent.setup(); const onChange = vi.fn();
    render(<ChapterCompletionEditor value={{ required_subtopics: true, learning_check_required: true, learning_check_pass_percentage: 80, custom: { keep: true } }} onChange={onChange} />);
    expect((screen.getByLabelText("Minimum score (%)") as HTMLInputElement).value).toBe("80");
    await user.click(screen.getByLabelText("Complete case study"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ case_study_required: true, custom: { keep: true } }));
  });

  it("shows activity-type controls without deleting custom keys", async () => {
    const onChange = vi.fn();
    render(<ActivityCompletionEditor activityType="CONCEPT_VIDEO" value={{ watch_percentage: 90, custom: "kept" }} onChange={onChange} />);
    const watch = screen.getByLabelText("Required watch percentage"); fireEvent.change(watch, { target: { value: "75" } });
    expect(onChange).toHaveBeenLastCalledWith({ watch_percentage: 75, custom: "kept" });
    expect(onChange.mock.calls.every(([value]) => value.custom === "kept")).toBe(true);
  });
});
