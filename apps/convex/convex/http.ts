import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/** CORS headers for browser clients (Vite dev, Electron renderer). */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Origin, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function corsJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

const http = httpRouter();

http.route({
  path: "/api/settings",
  method: "OPTIONS",
  handler: httpAction(async () => corsPreflightResponse()),
});

http.route({
  path: "/api/settings",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const settings = await ctx.runQuery(api.settings.listAsObject, {});
    return corsJsonResponse(settings);
  }),
});

export default http;
