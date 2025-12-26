import { describe, it, expect } from "bun:test";
import { validateChainingConflicts } from "./validateChainingConflicts";

describe("validateChainingConflicts", () => {
  it("returns true for empty tasks array", () => {
    expect(validateChainingConflicts([])).toBe(true);
  });

  it("returns true for single task", () => {
    expect(
      validateChainingConflicts([{ from: "/path/to/A", to: "/path/to/B" }]),
    ).toBe(true);
  });

  it("returns true when no chaining conflicts exist", () => {
    const tasks = [
      { from: "/path/to/A", to: "/path/to/B" },
      { from: "/path/to/C", to: "/path/to/D" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(true);
  });

  it("returns false when target is a source in another task", () => {
    const tasks = [
      { from: "/path/to/A", to: "/path/to/B" },
      { from: "/path/to/B", to: "/path/to/C" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(false);
  });

  it("returns false for chain of three tasks", () => {
    const tasks = [
      { from: "/path/to/A", to: "/path/to/B" },
      { from: "/path/to/B", to: "/path/to/C" },
      { from: "/path/to/C", to: "/path/to/D" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(false);
  });

  it("returns false when target of one task is source of another", () => {
    const tasks = [
      { from: "/path/to/A", to: "/path/to/B" },
      { from: "/path/to/C", to: "/path/to/A" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(false);
  });

  it("returns false when multiple tasks point to same target that is a source", () => {
    const tasks = [
      { from: "/path/to/A", to: "/path/to/B" },
      { from: "/path/to/C", to: "/path/to/B" },
      { from: "/path/to/B", to: "/path/to/D" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(false);
  });

  it("handles paths with special characters", () => {
    const tasks = [
      { from: "/path/with spaces/file (1).txt", to: "/new/path/file.txt" },
      { from: "/new/path/file.txt", to: "/final/path/file.md" },
    ];
    expect(validateChainingConflicts(tasks)).toBe(false);
  });
});
