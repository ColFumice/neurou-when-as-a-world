use crate::commands::fs::FsError;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const OUTPUT_LIMIT_BYTES: usize = 1024 * 1024;
const POLL_INTERVAL: Duration = Duration::from_millis(10);

pub struct ProcessOutput {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

pub fn ffmpeg_path() -> Result<PathBuf, FsError> {
    resolve_tool("NEUROU_FFMPEG", "ffmpeg")
}

pub fn ffprobe_path() -> Result<PathBuf, FsError> {
    resolve_tool("NEUROU_FFPROBE", "ffprobe")
}

fn resolve_tool(env_key: &str, fallback: &str) -> Result<PathBuf, FsError> {
    if let Ok(value) = std::env::var(env_key) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if !path.is_file() {
                return Err(FsError::new(
                    "MediaToolMissing",
                    format!("{env_key} does not point to a file"),
                ));
            }
            return Ok(path);
        }
    }
    Ok(PathBuf::from(fallback))
}

fn read_capped<R: Read>(mut reader: R, limit: usize) -> std::io::Result<(Vec<u8>, bool)> {
    let mut out = Vec::new();
    let mut truncated = false;
    let mut buffer = [0u8; 16 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        if out.len() < limit {
            let remaining = limit - out.len();
            let take = read.min(remaining);
            out.extend_from_slice(&buffer[..take]);
            if take < read {
                truncated = true;
            }
        } else {
            truncated = true;
        }
    }
    Ok((out, truncated))
}

/// 运行外部进程：参数数组、无 shell、stdin 关闭、输出上限、硬超时。
pub fn run_process(
    tool: &Path,
    args: &[OsString],
    timeout: Duration,
) -> Result<ProcessOutput, FsError> {
    let mut command = Command::new(tool);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            FsError::new(
                "MediaToolMissing",
                format!("cannot find media tool: {error}"),
            )
        } else {
            FsError::new("ProcessSpawnFailed", format!("cannot start media tool: {error}"))
        }
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| FsError::new("ProcessSpawnFailed", "stdout pipe unavailable"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| FsError::new("ProcessSpawnFailed", "stderr pipe unavailable"))?;

    let stdout_handle = thread::spawn(move || read_capped(stdout, OUTPUT_LIMIT_BYTES));
    let stderr_handle = thread::spawn(move || read_capped(stderr, OUTPUT_LIMIT_BYTES));

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err(FsError::new(
                        "ProcessTimeout",
                        format!("media tool timed out after {}s", timeout.as_secs()),
                    ));
                }
                thread::sleep(POLL_INTERVAL);
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();
                return Err(FsError::new(
                    "ProcessFailed",
                    format!("cannot wait for media tool: {error}"),
                ));
            }
        }
    };

    let stdout = stdout_handle
        .join()
        .map_err(|_| FsError::new("ProcessFailed", "stdout reader panicked"))?
        .map_err(|error| FsError::new("ProcessFailed", format!("cannot read stdout: {error}")))?;
    let stderr = stderr_handle
        .join()
        .map_err(|_| FsError::new("ProcessFailed", "stderr reader panicked"))?
        .map_err(|error| FsError::new("ProcessFailed", format!("cannot read stderr: {error}")))?;

    if stdout.1 || stderr.1 {
        return Err(FsError::new(
            "OutputTooLarge",
            "media tool output exceeded the 1 MiB limit",
        ));
    }

    Ok(ProcessOutput {
        status,
        stdout: stdout.0,
        stderr: stderr.0,
    })
}

pub fn run_checked(
    tool: &Path,
    args: &[OsString],
    timeout: Duration,
    context: &str,
) -> Result<ProcessOutput, FsError> {
    let output = run_process(tool, args, timeout)?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr);
        let message = message.trim();
        return Err(FsError::new(
            context,
            if message.is_empty() {
                format!("media tool exited with {}", output.status)
            } else {
                format!("media tool failed: {message}")
            },
        ));
    }
    Ok(output)
}
