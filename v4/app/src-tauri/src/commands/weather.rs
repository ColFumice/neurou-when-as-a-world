use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationData {
    pub latitude: f64,
    pub longitude: f64,
    pub timezone: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub weather_code: i64,
    pub precipitation_mm: f64,
    pub is_rain: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherError {
    pub code: String,
    pub message: String,
}

impl WeatherError {
    fn network() -> Self {
        Self {
            code: "NetworkError".to_string(),
            message: "external weather request failed".to_string(),
        }
    }

    fn parse() -> Self {
        Self {
            code: "ParseError".to_string(),
            message: "external weather response was invalid".to_string(),
        }
    }

    fn invalid() -> Self {
        Self {
            code: "InvalidRequest".to_string(),
            message: "latitude/longitude is invalid".to_string(),
        }
    }
}

fn client() -> Result<Client, WeatherError> {
    Client::builder()
        .timeout(TIMEOUT)
        .build()
        .map_err(|_| WeatherError::network())
}

async fn get_json(url: &str) -> Result<Value, WeatherError> {
    let response = client()?
        .get(url)
        .send()
        .await
        .map_err(|_| WeatherError::network())?;
    if !response.status().is_success() {
        return Err(WeatherError::network());
    }
    let body = response.text().await.map_err(|_| WeatherError::network())?;
    serde_json::from_str(&body).map_err(|_| WeatherError::parse())
}

fn parse_timezone(value: &Value) -> Option<String> {
    if let Some(timezone) = value.get("timezone").and_then(Value::as_str) {
        return Some(timezone.to_string());
    }
    value
        .get("timezone")
        .and_then(|timezone| timezone.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn parse_location(value: &Value) -> Result<LocationData, WeatherError> {
    if value.get("success").and_then(Value::as_bool) == Some(false) {
        return Err(WeatherError::parse());
    }
    let latitude = value
        .get("latitude")
        .and_then(Value::as_f64)
        .filter(|number| number.is_finite() && (-90.0..=90.0).contains(number))
        .ok_or_else(WeatherError::parse)?;
    let longitude = value
        .get("longitude")
        .and_then(Value::as_f64)
        .filter(|number| number.is_finite() && (-180.0..=180.0).contains(number))
        .ok_or_else(WeatherError::parse)?;
    let timezone = parse_timezone(value).ok_or_else(WeatherError::parse)?;
    if timezone.trim().is_empty() {
        return Err(WeatherError::parse());
    }
    Ok(LocationData {
        latitude,
        longitude,
        timezone,
    })
}

fn is_rain(weather_code: i64, precipitation_mm: f64) -> bool {
    const SNOW: [i64; 6] = [71, 73, 75, 77, 85, 86];
    const RAIN: [i64; 16] = [
        51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
    ];
    if SNOW.contains(&weather_code) {
        return false;
    }
    RAIN.contains(&weather_code) || precipitation_mm > 0.0
}

fn parse_weather(value: &Value) -> Result<WeatherData, WeatherError> {
    let current = value.get("current").ok_or_else(WeatherError::parse)?;
    let weather_code = current
        .get("weather_code")
        .or_else(|| current.get("weathercode"))
        .and_then(Value::as_i64)
        .ok_or_else(WeatherError::parse)?;
    let precipitation_mm = current
        .get("precipitation")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    if !precipitation_mm.is_finite() || precipitation_mm < 0.0 {
        return Err(WeatherError::parse());
    }
    Ok(WeatherData {
        weather_code,
        precipitation_mm,
        is_rain: is_rain(weather_code, precipitation_mm),
    })
}

#[tauri::command]
pub async fn location_resolve() -> Result<LocationData, WeatherError> {
    // ipwho.is 无需 Key；每次调用都请求，不缓存。
    let value = get_json("https://ipwho.is/").await?;
    parse_location(&value)
}

#[tauri::command]
pub async fn weather_resolve(lat: f64, lon: f64) -> Result<WeatherData, WeatherError> {
    if !lat.is_finite() || !(-90.0..=90.0).contains(&lat)
        || !lon.is_finite() || !(-180.0..=180.0).contains(&lon) {
        return Err(WeatherError::invalid());
    }
    // Open-Meteo 无需 Key；每次调用都请求，不缓存。
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=weather_code,precipitation"
    );
    let value = get_json(&url).await?;
    parse_weather(&value)
}

#[cfg(test)]
mod tests {
    use super::{is_rain, parse_location, parse_weather};
    use serde_json::json;

    #[test]
    fn location_parses_timezone_object() {
        let data = parse_location(&json!({
            "success": true,
            "latitude": 31.23,
            "longitude": 121.47,
            "timezone": { "id": "Asia/Shanghai" }
        }))
        .expect("valid location");
        assert_eq!(data.latitude, 31.23);
        assert_eq!(data.longitude, 121.47);
        assert_eq!(data.timezone, "Asia/Shanghai");
    }

    #[test]
    fn location_rejects_missing_coordinates() {
        assert!(parse_location(&json!({ "success": true })).is_err());
        assert!(parse_location(&json!({ "success": false })).is_err());
    }

    #[test]
    fn weather_parses_current_and_rain_flag() {
        let data = parse_weather(&json!({
            "current": { "weather_code": 61, "precipitation": 3.2 }
        }))
        .expect("valid weather");
        assert_eq!(data.weather_code, 61);
        assert_eq!(data.precipitation_mm, 3.2);
        assert!(data.is_rain);
    }

    #[test]
    fn snow_is_not_rain() {
        assert!(!is_rain(71, 2.0));
        assert!(is_rain(61, 0.0));
        assert!(!is_rain(0, 0.0));
    }
}
