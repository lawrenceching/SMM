## 1. Update Status Message Composition

- [x] 1.1 Locate the VideoCaptioner unavailable status message creation path in the UI status bar flow.
- [x] 1.2 Add the help `link` value `https://github.com/WEIFENG2333/VideoCaptioner#cli-%E5%91%BD%E4%BB%A4%E8%A1%8C` to the `videocaptioner not found` message entry while preserving `type: error`.

## 2. Validation and Coverage

- [x] 2.1 Update or add assertions to verify the VideoCaptioner not-found message includes the expected help link metadata.
- [x] 2.2 Run relevant UI checks/tests and confirm no regression in existing status bar message indicator behavior.
