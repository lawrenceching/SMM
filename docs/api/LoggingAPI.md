# Logging API

Logging API 允许前端应用向后端发送日志，并通过 Pino logger 持久化到日志文件。

## 功能特性

- **日志级别支持**: 支持 `trace`, `debug`, `info`, `warn`, `error`, `fatal` 六种日志级别
- **速率限制**: 每秒最多允许 10 条日志，超出限制的日志将被静默丢弃
- **自动持久化**: 日志通过 Pino 自动写入到配置的日志文件
- **上下文支持**: 支持传递额外的上下文对象，便于调试和追踪

## 速率限制

为了防止前端出现问题导致大量日志被写入磁盘，API 实现了速率限制：

- **限制**: 每秒最多 10 条日志
- **超出处理**: 超出限制的日志请求将直接返回 `204 No Content`，不会写入日志文件
- **计数器重置**: 每秒重置计数器

## API 端点

### `POST /api/log`

从前端发送日志到后端。

#### 请求格式

```typescript
interface LogRequestBody {
  /**
   * 日志级别
   * @default "info"
   */
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /**
   * 日志消息（必填）
   */
  message: string;

  /**
   * 额外的上下文对象（可选）
   */
  context?: Record<string, unknown>;
}
```

#### 请求示例

```bash
# 发送 info 级别日志
curl -X POST http://localhost:30000/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "用户点击了重命名按钮",
    "context": {
      "userId": "user-123",
      "action": "rename",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'

# 发送 error 级别日志
curl -X POST http://localhost:30000/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "message": "文件重命名失败",
    "context": {
      "filePath": "/path/to/file.mp4",
      "error": "Permission denied"
    }
  }'

# 只发送消息（默认 info 级别）
curl -X POST http://localhost:30000/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "message": "应用启动完成"
  }'
```

#### 响应

| 状态码 | 描述 |
|--------|------|
| `204 No Content` | 日志写入成功或速率限制超出（静默丢弃） |
| `400 Bad Request` | 请求体验证失败或 JSON 解析错误 |

#### 错误响应示例

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "message",
      "message": "Message is required"
    }
  ]
}
```

### 日志格式

前端发送的日志会在 Pino 日志文件中包含 `source: "frontend"` 字段，以便区分前后端日志：

```json
{
  "level": 30,
  "time": 1715781000000,
  "pid": 1234,
  "hostname": "localhost",
  "source": "frontend",
  "userId": "user-123",
  "action": "rename",
  "msg": "用户点击了重命名按钮"
}
```

## 日志存储

日志文件位置取决于运行环境和配置：

- **Windows**: `%LOCALAPPDATA%\SMM\logs\smm.log`
- **macOS**: `~/Library/Logs/SMM/smm.log`
- **Linux**: `~/.local/share/smm/logs/smm.log`

可以通过环境变量自定义日志目录：
- `LOG_DIR`: 自定义日志目录路径
- `LOG_TARGET`: 设置为 `file` 启用文件日志（默认 `console`）
- `LOG_LEVEL`: 设置日志级别（默认 `info`）

## 前端使用示例

```typescript
// 日志服务封装
class LogService {
  private async sendLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, context }),
      });
    } catch (error) {
      // 日志发送失败时，静默处理，避免循环错误
      console.error('Failed to send log:', error);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    return this.sendLog('info', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    return this.sendLog('error', message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    return this.sendLog('debug', message, context);
  }
}

// 使用示例
const logger = new LogService();

logger.info('用户登录成功', { userId: '123' });
logger.error('API 调用失败', { endpoint: '/api/tmdb/search', status: 500 });
```

## 实现细节

### 速率限制器

使用简单的内存计数器实现：

```typescript
class RateLimiter {
  private requestCounts: Map<string, { count: number; resetTime: number }>;

  isAllowed(key: string = 'global'): boolean {
    // 每秒最多 10 条
    // 超出返回 false
  }
}
```

### 日志级别映射

| API Level | Pino Method |
|-----------|-------------|
| `trace`   | `logger.trace()` |
| `debug`   | `logger.debug()` |
| `info`    | `logger.info()` |
| `warn`    | `logger.warn()` |
| `error`   | `logger.error()` |
| `fatal`   | `logger.fatal()` |

## 注意事项

1. **速率限制**: 前端应该合理控制日志发送频率，避免触发速率限制
2. **错误处理**: 日志发送失败时不会抛出错误，避免影响主业务流程
3. **上下文大小**: 建议保持上下文对象简洁，避免传递过大的对象
4. **敏感信息**: 不要在日志中传递敏感信息（如密码、API Key 等）
