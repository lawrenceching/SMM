# API Design Guideline

The HTTP API follows the RPC naming style.

Every response contains "data" and "error" fields.
The "data" field contains the response data.
The "error" field contains the error message.

The HTTP status is ONLY used for express HTTP layer status, not business layer.
For example, "404" means the HTTP API was not implemented, instead of resource not found.
If the requested resource was not found, return error in "error" field.

The error message is in format "Error Reason: detail message".
For example, `File Not Found: /path/to/folder was not found`