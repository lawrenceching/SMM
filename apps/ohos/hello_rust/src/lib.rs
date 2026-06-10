use napi_derive_ohos::napi;
use napi_ohos::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, Mutex, mpsc};
use std::thread;
use std::time::Duration;

static HTTP_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);
static SELECT_HANDLER: LazyLock<Mutex<Option<ThreadsafeFunction<()>>>> =
    LazyLock::new(|| Mutex::new(None));
static PENDING_SELECT: LazyLock<Mutex<Option<mpsc::Sender<String>>>> =
    LazyLock::new(|| Mutex::new(None));

const HEALTH_BODY: &str = r#"{"status": "ok"}"#;
const SELECT_TIMEOUT: Duration = Duration::from_secs(120);

#[napi]
pub fn hello() -> String {
    "Hello from Rust!".to_string()
}

#[napi]
pub fn register_select_file_handler(handler: ThreadsafeFunction<()>) {
    *SELECT_HANDLER.lock().unwrap() = Some(handler);
}

#[napi]
pub fn complete_select_file(result: String) {
    if let Some(tx) = PENDING_SELECT.lock().unwrap().take() {
        let _ = tx.send(result);
    }
}

#[napi]
pub fn start_http_server(port: u32) -> bool {
    if HTTP_SERVER_RUNNING.load(Ordering::SeqCst) {
        return false;
    }

    let addr = format!("0.0.0.0:{}", port);
    match TcpListener::bind(&addr) {
        Ok(listener) => {
            let _ = listener.set_nonblocking(true);
            HTTP_SERVER_RUNNING.store(true, Ordering::SeqCst);

            thread::spawn(move || {
                while HTTP_SERVER_RUNNING.load(Ordering::SeqCst) {
                    match listener.accept() {
                        Ok((stream, _)) => {
                            handle_client(stream);
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(100));
                        }
                        Err(_) => {
                            HTTP_SERVER_RUNNING.store(false, Ordering::SeqCst);
                            break;
                        }
                    }
                }
            });

            true
        }
        Err(_) => false,
    }
}

#[napi]
pub fn stop_http_server() {
    HTTP_SERVER_RUNNING.store(false, Ordering::SeqCst);
}

fn handle_client(mut stream: TcpStream) {
    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request = String::from_utf8_lossy(&buf[..n]);
    let response = build_response(&request);
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn build_response(request: &str) -> String {
    let request_line = request.lines().next().unwrap_or("");
    let parts: Vec<&str> = request_line.split_whitespace().collect();

    if parts.len() < 2 {
        return http_response(400, "text/plain", "Bad Request");
    }

    let path = parts[1];

    match path {
        "/health" => http_response(200, "application/json", HEALTH_BODY),
        "/listFiles" => {
            let (status, body) = list_files_response();
            http_response(status, "application/json", &body)
        }
        "/selectFile" => {
            let (status, body) = select_file_response();
            http_response(status, "application/json", &body)
        }
        _ => http_response(404, "text/plain", "Not Found"),
    }
}

fn select_file_response() -> (u32, String) {
    if PENDING_SELECT.lock().unwrap().is_some() {
        return (
            409,
            r#"{"uris":[],"error":"select already in progress"}"#.to_string(),
        );
    }

    let (tx, rx) = mpsc::channel();
    *PENDING_SELECT.lock().unwrap() = Some(tx);

    {
        let guard = SELECT_HANDLER.lock().unwrap();
        match guard.as_ref() {
            Some(handler) => {
                handler.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
            }
            None => {
                PENDING_SELECT.lock().unwrap().take();
                return (
                    503,
                    r#"{"uris":[],"error":"handler not registered"}"#.to_string(),
                );
            }
        }
    }

    match rx.recv_timeout(SELECT_TIMEOUT) {
        Ok(body) => (200, body),
        Err(_) => {
            PENDING_SELECT.lock().unwrap().take();
            (
                504,
                r#"{"uris":[],"error":"timeout"}"#.to_string(),
            )
        }
    }
}

fn list_files_response() -> (u32, String) {
    let temp_dir = std::env::temp_dir();
    let directory = temp_dir.to_string_lossy().into_owned();

    let entries = match std::fs::read_dir(&temp_dir) {
        Ok(entries) => entries,
        Err(err) => {
            let body = format!(
                r#"{{"directory":"{}","files":[],"error":"{}"}}"#,
                json_escape(&directory),
                json_escape(&err.to_string())
            );
            return (500, body);
        }
    };

    let mut files: Vec<String> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect();
    files.sort();

    let files_json = files
        .iter()
        .map(|name| format!(r#""{}""#, json_escape(name)))
        .collect::<Vec<_>>()
        .join(",");

    let body = format!(
        r#"{{"directory":"{}","files":[{}]}}"#,
        json_escape(&directory),
        files_json
    );
    (200, body)
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn http_response(status_code: u32, content_type: &str, body: &str) -> String {
    let status_line = match status_code {
        200 => "200 OK",
        400 => "400 Bad Request",
        404 => "404 Not Found",
        409 => "409 Conflict",
        500 => "500 Internal Server Error",
        503 => "503 Service Unavailable",
        504 => "504 Gateway Timeout",
        _ => "500 Internal Server Error",
    };

    format!(
        "HTTP/1.1 {}\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\
         \r\n\
         {}",
        status_line,
        content_type,
        body.len(),
        body
    )
}
