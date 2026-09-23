import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpportunityMarkdown, safeOpportunityUrl } from "./opportunity-markdown";

describe("OpportunityMarkdown", () => {
  it("renders supported markdown and secures external links", () => {
    render(
      <OpportunityMarkdown>
        {"## Role\n\n- Build models\n- Explain results\n\n[Company](https://example.com)"}
      </OpportunityMarkdown>,
    );

    expect(screen.getByRole("heading", { name: "Role" })).not.toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Company" }).getAttribute("rel")).toBe(
      "noreferrer noopener",
    );
  });

  it("does not render raw HTML or unsafe URL schemes", () => {
    const { container } = render(
      <OpportunityMarkdown>
        {'<script>alert("no")</script>\n\n[Unsafe](javascript:alert(1))'}
      </OpportunityMarkdown>,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("Unsafe").closest("a")?.getAttribute("href")).not.toBe(
      "javascript:alert(1)",
    );
    expect(safeOpportunityUrl("data:text/html,bad")).toBe("");
  });
});
