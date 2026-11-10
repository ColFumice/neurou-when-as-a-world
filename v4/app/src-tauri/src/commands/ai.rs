use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

const MAX_TIMEOUT_MS: u64 = 120_000;
const MIN_TIMEOUT_MS: u64 = 100;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpResponse {
    pub status: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpError {
    pub code: String,
    pub message: String,
}

impl AiHttpError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "InvalidRequest".to_string(),
            message: message.into(),
        }
    }

    fn network() -> Self {
        Self {
            code: "NetworkError".to_string(),
            message: "network request failed".to_string(),
        }
    }
}

fn validate_endpoint(endpoint: &str) -> Result<(), AiHttpError> {
    if endpoint.len() > 2048 {
        return Err(AiHttpError::invalid("endpoint is too long"));
    }
    let lower = endpoint.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(AiHttpError::invalid("endpoint must use http or https"));
    }
    if endpoint.chars().any(|character| character.is_control() || character.is_whitespace()) {
        return Err(AiHttpError::invalid("endpoint contains whitespace"));
    }
    Ok(())
}

fn clamp_timeout(timeout_ms: u64) -> u64 {
    timeout_ms.clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
}

fn parse_method(method: &str) -> Result<reqwest::Method, AiHttpError> {
    match method.to_ascii_uppercase().as_str() {
        "GET" => Ok(reqwest::Method::GET),
        "POST" => Ok(reqwest::Method::POST),
        _ => Err(AiHttpError::invalid("method must be GET or POST")),
    }
}

fn parse_headers(headers: Option<HashMap<String, String>>) -> Result<HeaderMap, AiHttpError> {
    let mut result = HeaderMap::new();
    let Some(headers) = headers else {
        return Ok(result);
    };
    for (name, value) in headers {
        let name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| AiHttpError::invalid("invalid header name"))?;
        let value = HeaderValue::from_str(&value)
            .map_err(|_| AiHttpError::invalid("invalid header value"))?;
        result.insert(name, value);
    }
    result.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    Ok(result)
}

#[tauri::command]
pub async fn ai_http_request(
    endpoint: String,
    method: String,
    body: String,
    timeout_ms: u64,
    headers: Option<HashMap<String, String>>,
) -> Result<AiHttpResponse, AiHttpError> {
    validate_endpoint(&endpoint)?;
    let method = parse_method(&method)?;
    let timeout = clamp_timeout(timeout_ms);
    let headers = parse_headers(headers)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout))
        .build()
        .map_err(|_| AiHttpError::network())?;

    let mut request = client.request(method.clone(), &endpoint).headers(headers);
    if method != reqwest::Method::GET && !body.is_empty() {
        request = request.body(body);
    }
    let response = request.send().await.map_err(|_| AiHttpError::network())?;
    let status = response.status().as_u16();
    let mut response_headers = HashMap::new();
    for (name, value) in response.headers() {
        if let Ok(value) = value.to_str() {
            response_headers.insert(name.as_str().to_string(), value.to_string());
        }
    }
    let body = response.text().await.map_err(|_| AiHttpError::network())?;
    Ok(AiHttpResponse {
        status,
        body,
        headers: response_headers,
    })
}

#[cfg(test)]
mod tests {
    use super::{clamp_timeout, parse_method, parse_headers, validate_endpoint};
    use std::collections::HashMap;

    #[test]
    fn endpoint_validation() {
        assert!(validate_endpoint("https://example.test/v1").is_ok());
        assert!(validate_endpoint("http://127.0.0.1:11434").is_ok());
        assert!(validate_endpoint("file:///etc/passwd").is_err());
        assert!(validate_endpoint("https://example.test/a b").is_err());
    }

    #[test]
    fn timeout_is_clamped() {
        assert_eq!(clamp_timeout(0), 100);
        assert_eq!(clamp_timeout(50), 100);
        assert_eq!(clamp_timeout(5_000), 5_000);
        assert_eq!(clamp_timeout(999_999), 120_000);
    }

    #[test]
    fn headers_are_validated() {
        let mut headers = HashMap::new();
        headers.insert("authorization".to_string(), "Bearer test".to_string());
        let parsed = parse_headers(Some(headers)).expect("valid headers");
        assert_eq!(parsed.get("authorization").unwrap(), "Bearer test");
        assert!(parse_headers(Some(HashMap::from([(
            "bad header".to_string(),
            "x".to_string(),
        )])))
        .is_err());
    }

    #[test]
    fn methods_are_limited() {
        assert!(parse_method("POST").is_ok());
        assert!(parse_method("get").is_ok());
        assert!(parse_method("DELETE").is_err());
    }
}
