import { describe, expect, it, vi } from "vitest";
import { navigateAfterLogout } from "./logout-navigation";

describe("logout navigation", () => {
  it("uses client routing for a local-password logout", () => {
    const replace = vi.fn();
    const assign = vi.fn();
    navigateAfterLogout({ redirect_to: "/login", auth0: false }, replace, assign);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(assign).not.toHaveBeenCalled();
  });

  it("performs a document navigation through the Auth0 logout endpoint", () => {
    const replace = vi.fn();
    const assign = vi.fn();
    navigateAfterLogout({ redirect_to: "/auth/logout?returnTo=/learn/login", auth0: true }, replace, assign);
    expect(assign).toHaveBeenCalledWith("/auth/logout?returnTo=/learn/login");
    expect(replace).not.toHaveBeenCalled();
  });
});
