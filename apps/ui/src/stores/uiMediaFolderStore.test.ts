/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invalidateQueries = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: (...args: unknown[]) => invalidateQueries(...args),
  },
}));

import { useUIMediaFolderStore } from "./uiMediaFolderStore";
import { PLANS_QUERY_ROOT } from "@/hooks/plans/plansQueryKeys";

describe("uiMediaFolderStore.applyFolderClick pulls pending plans", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useUIMediaFolderStore.setState({
      folders: [],
      selectedFolder: "",
      selectedFolders: [],
    });
  });

  it("invalidates the plans query on single click", () => {
    useUIMediaFolderStore.getState().applyFolderClick("/media/show", false);

    expect(useUIMediaFolderStore.getState().selectedFolder).toBe("/media/show");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PLANS_QUERY_ROOT],
    });
  });

  it("invalidates the plans query when re-selecting the same folder", () => {
    useUIMediaFolderStore.setState({
      selectedFolder: "/media/show",
      selectedFolders: ["/media/show"],
    });

    useUIMediaFolderStore.getState().applyFolderClick("/media/show", false);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("invalidates the plans query on multi-select click too", () => {
    useUIMediaFolderStore.getState().applyFolderClick("/media/show", true);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
