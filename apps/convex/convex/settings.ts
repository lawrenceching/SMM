import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_SETTINGS: Record<string, string> = {
  latestVersion: "1.2.4",
};

export const listAsObject = query({
  args: {},
  returns: v.record(v.string(), v.string()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("settings").collect();
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },
});

/** Idempotent seed for default SMM settings (run once per deployment). */
export const seedDefaults = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (!existing) {
        await ctx.db.insert("settings", { key, value });
      }
    }
    return null;
  },
});
