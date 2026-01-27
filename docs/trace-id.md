# Trace Id

The trace id is used to track from user action to backend API operation.

The solution helps developer to understand why action was triggered which is significant useful for debugging.

Trace Id should be generated in where the event starts, and pass down via the method argument.

Print trace id in log so that developer can easy to filter log for the same event.

For example:

1. [UI] User confirm the rename plan (trace id was generated at this point)
2. [UI] call reanmeFiles API with trace id
3. [Backend] received trace id from API request body
4. [UI] update media metadata and print log with trace id
5. [UI] call writeFile API with trace id
6. [Backend] received trace id from API request body

Trace id is in format:
```
{event_name}-{counter}

# Example
AppV2-1241
ConfirmedRename-1322
```
The event name could be source code file name, the counter is integer, start with 1.

Trace id don't need to be unique.

`nextTraceId()` method in `ui\src\lib\utils.ts` is created to generate trace id.