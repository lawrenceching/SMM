# Read Image API

Read Image API read image file and return the base64 encoded data;

POST /api/readImage

```typescript
interface ReadImageRequestBody {
    path: string;
}

interface ReadImageResponseBody {
    /**
     * In a format "data:image:xxxx"
     */ 
    data: string;
}
```

## Source

Source: `packages/core-routes/src/readImage.ts` (pure function
`doReadImage`, framework- and runtime-agnostic). The Hono shell
at `apps/cli/src/route/ReadImage.ts` is a thin adapter that
delegates to `doReadImage`.

Served by both the Hono Bun server (apps/cli port 30000) and the
core-routes Node `http` server (port from
`HelloResponseBody.coreRoutesPort`, default 3001 on the desktop CLI,
18081 on HarmonyOS).