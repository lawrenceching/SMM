# Trace ID Testing Instructions

This document provides manual testing steps for verifying trace ID implementation in the `add-trace-id-for-save-user-config` change.

## Prerequisites

1. CLI dev server running on `http://localhost:30000`
2. UI accessible at `http://localhost:30000`
3. Browser DevTools open (Console tab)

## Test 6.1: UI Console Logs with Trace ID

**Objective**: Verify trace IDs appear in browser console with correct `[traceId]` prefix format.

**Steps**:
1. Open browser DevTools Console tab
2. Navigate to Settings → AI Settings
3. Change any setting (e.g., API key or model)
4. Click Save button
5. Observe console output

**Expected Results**:
```
[AiSettings-1241] AiSettings: Saving AI settings
[AiSettings-1241] saveUserConfig: Starting save operation
[AiSettings-1241] saveUserConfig: Writing config to C:\Users\lawrence\AppData\Roaming\SMM\smm.json
[AiSettings-1241] writeFile: Writing to C:\Users\lawrence\AppData\Roaming\SMM\smm.json
[AiSettings-1241] writeFile: Response received {data: null}
[AiSettings-1241] saveUserConfig: User config written successfully
```

**Key Points**:
- Trace ID format: `[AiSettings-1241]` (event_name-counter)
- Same trace ID appears in all related log messages
- Logs appear at each layer: AI Settings → saveUserConfig → writeFile

---

## Test 6.2: Backend Logs with Trace ID (Pino Format)

**Objective**: Verify backend logs include trace ID counter as number in pino structured format.

**Steps**:
1. Open backend log file: `C:\Users\lawrence\AppData\Local\SMM\logs\smm.log`
2. Filter for trace ID from Test 6.1 (e.g., counter 1241)
3. Observe log structure

**Expected Results**:
```json
{"level":30,"time":1769528589175,"pid":28740,"hostname":"GameStation","traceId":1241,"msg":"doWriteFile: Starting file write operation"}
{"level":30,"time":1769528589176,"pid":28740,"hostname":"GameStation","traceId":1241,"filePath":"C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json","mode":"overwrite","dataSize":1234,"msg":"doWriteFile: Processing write request"}
{"level":30,"time":1769528589180,"pid":28740,"hostname":"GameStation","traceId":1241,"path":"C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json","size":1234,"msg":"doWriteFile: File written successfully (overwrite mode)"}
```

**Key Points**:
- `traceId` field is a number (not string)
- Log entry includes structured JSON with `traceId` property
- Same trace ID counter (1241) appears across all backend operations

---

## Test 6.3: End-to-End Log Correlation

**Objective**: Verify logs can be correlated from UI console through to backend logs.

**Steps**:
1. Perform Test 6.1 (save AI Settings)
2. Note the trace ID from UI console (e.g., `AiSettings-1241`)
3. Extract the counter: `1241`
4. Search UI console logs: `grep "AiSettings-1241"` (or use DevTools filter)
5. Search backend logs: `grep '"traceId":1241'` or use log analysis tool
6. Verify complete request flow

**Expected Results**:

**UI Console Logs** (filtered by `AiSettings-1241`):
```
[AiSettings-1241] AiSettings: Saving AI settings
[AiSettings-1241] saveUserConfig: Starting save operation
[AiSettings-1241] saveUserConfig: Writing config to C:\Users\lawrence\AppData\Roaming\SMM\smm.json
[AiSettings-1241] writeFile: Writing to C:\Users\lawrence\AppData\Roaming\SMM\smm.json
[AiSettings-1241] writeFile: Response received
[AiSettings-1241] saveUserConfig: User config written successfully
```

**Backend Logs** (filtered by `traceId:1241`):
```json
{"traceId":1241,"msg":"doWriteFile: Starting file write operation"}
{"traceId":1241,"msg":"doWriteFile: Processing write request"}
{"traceId":1241,"msg":"doWriteFile: File written successfully"}
```

**Key Points**:
- Same trace ID counter (1241) links all logs from UI to backend
- Complete flow visible: UI → API → HTTP → Backend → File System

---

## Test 6.4: Backward Compatibility (Missing Trace ID)

**Objective**: Verify system handles missing trace ID gracefully.

**Steps**:
1. Create a simple test script that calls `/api/writeFile` without `X-Trace-Id` header:
```bash
curl -X POST http://localhost:30000/api/writeFile \
  -H "Content-Type: application/json" \
  -d '{"path":"C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\test.json","mode":"overwrite","data":"test"}'
```
2. Observe backend logs for this request

**Expected Results**:
```json
{"level":30,"time":1769528589175,"pid":28740,"traceId":0,"msg":"doWriteFile: Starting file write operation"}
```

**Key Points**:
- `traceId` defaults to `0` when header is missing
- No errors occur due to missing trace ID
- Request processing completes successfully

---

## Test 6.5: Concurrent Requests with Unique Trace IDs

**Objective**: Verify multiple concurrent requests generate unique incrementing trace IDs.

**Steps**:
1. Open browser DevTools Console
2. Navigate to Settings → General Settings
3. Note current trace ID counter (e.g., `GeneralSettings-1242`)
4. Quickly click Save multiple times (3-5 times in rapid succession)
5. Observe trace IDs in console

**Expected Results**:
```
[GeneralSettings-1242] GeneralSettings: Saving general settings
[GeneralSettings-1243] GeneralSettings: Saving general settings
[GeneralSettings-1244] GeneralSettings: Saving general settings
[GeneralSettings-1245] GeneralSettings: Saving general settings
[GeneralSettings-1246] GeneralSettings: Saving general settings
```

**Key Points**:
- Each request gets a unique trace ID
- Counter increments sequentially (1242, 1243, 1244, ...)
- No collisions between concurrent requests

---

## Test 6.6: localStorage Persistence Across Page Reloads

**Objective**: Verify trace ID counter persists and increments across page reloads.

**Steps**:
1. Open browser DevTools Console
2. Navigate to Settings → AI Settings
3. Note trace ID from first save (e.g., `AiSettings-1247`)
4. Refresh the page (F5 or Ctrl+R)
5. Navigate back to AI Settings and save again
6. Note new trace ID (should be > 1247, e.g., `AiSettings-1248`)

**Expected Results**:
```
[AiSettings-1247] AiSettings: Saving AI settings  // Before refresh
// Page refresh happens
[AiSettings-1248] AiSettings: Saving AI settings  // After refresh - counter incremented
```

**Key Points**:
- Counter increments across page reloads
- LocalStorage stores the counter between sessions
- Counter never decreases or resets

---

## Test 6.7: Request Body Unchanged

**Objective**: Verify trace ID is only in HTTP header, not in request body.

**Steps**:
1. Open browser DevTools Network tab
2. Navigate to Settings → AI Settings
3. Change a setting and Save
4. Click the `/api/writeFile` request in Network tab
5. View request headers and request payload

**Expected Results**:

**Request Headers**:
```
Content-Type: application/json
X-Trace-Id: 1247
```

**Request Body**:
```json
{
  "path": "C:\\Users\\lawrence\\AppData\\Roaming\\SMM\\smm.json",
  "data": "{\"applicationLanguage\":\"zh-CN\",\"tmdb\":{...},\"ai\":{...},...}",
  "mode": "overwrite"
}
```

**Key Points**:
- `X-Trace-Id` header present with numeric counter (e.g., "1247")
- Request body contains only `path`, `data`, `mode` fields
- No `traceId` field in request body
- API contract unchanged from before this change

---

## Summary Checklist

- [ ] Test 6.1: UI console logs show `[traceId]` prefix with `{event_name}-{counter}` format
- [ ] Test 6.2: Backend logs show `traceId` as number in pino format
- [ ] Test 6.3: End-to-end correlation works between UI and backend logs
- [ ] Test 6.4: Backward compatibility - missing trace ID defaults to 0
- [ ] Test 6.5: Concurrent requests generate unique incrementing counters
- [ ] Test 6.6: LocalStorage persistence - counter increments across page reloads
- [ ] Test 6.7: Request body unchanged - trace ID only in header
