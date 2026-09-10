/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

const invalidateQueries = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueries(...args),
  },
}));

import { usePlansPullOnVisible } from "./usePlansPullOnVisible";
import { useUIMediaFolderStore } from "@/stores/uiMediaFolderStore";
import { PLANS_QUERY_ROOT } from "./plansQueryKeys";

function fireVisibilityChange(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePlansPullOnVisible", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useUIMediaFolderStore.setState({
      selectedFolder: "/media/show",
      selectedFolders: ["/media/show"],
    });
  });

  afterEach(() => {
    fireVisibilityChange("visible");
  });

  it("invalidates the plans query when the browser becomes visible", () => {
    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("visible");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PLANS_QUERY_ROOT],
    });
  });

  it("does not invalidate when the browser becomes hidden", () => {
    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("hidden");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not invalidate when no folder is selected", () => {
    useUIMediaFolderStore.setState({ selectedFolder: "", selectedFolders: [] });

    renderHook(() => usePlansPullOnVisible());

    fireVisibilityChange("visible");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => usePlansPullOnVisible());
    unmount();

    fireVisibilityChange("visible");

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
