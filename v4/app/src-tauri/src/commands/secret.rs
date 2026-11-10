use keyring::Entry;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretError {
    pub code: String,
    pub message: String,
}

impl SecretError {
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "InvalidRequest".to_string(),
            message: message.into(),
        }
    }

    fn unavailable() -> Self {
        Self {
            code: "KeyStoreUnavailable".to_string(),
            message: "OS key store is unavailable".to_string(),
        }
    }
}

fn validate(service: &str, account: &str) -> Result<(), SecretError> {
    if service.is_empty() || service.len() > 256
        || account.is_empty() || account.len() > 256
        || service.chars().any(char::is_control)
        || account.chars().any(char::is_control) {
        return Err(SecretError::invalid("service/account is invalid"));
    }
    Ok(())
}

fn entry(service: &str, account: &str) -> Result<Entry, SecretError> {
    validate(service, account)?;
    Entry::new(service, account).map_err(|_| SecretError::unavailable())
}

#[tauri::command]
pub fn secret_set(
    service: String,
    account: String,
    value: String,
) -> Result<(), SecretError> {
    let entry = entry(&service, &account)?;
    entry.set_password(&value).map_err(|_| SecretError::unavailable())
}

#[tauri::command]
pub fn secret_get(
    service: String,
    account: String,
) -> Result<Option<String>, SecretError> {
    let entry = entry(&service, &account)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err(SecretError::unavailable()),
    }
}

#[tauri::command]
pub fn secret_delete(
    service: String,
    account: String,
) -> Result<(), SecretError> {
    let entry = entry(&service, &account)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err(SecretError::unavailable()),
    }
}

#[cfg(test)]
mod tests {
    use super::validate;

    #[test]
    fn rejects_empty_or_control_values() {
        assert!(validate("cn.neurou.app", "ai:cloud").is_ok());
        assert!(validate("", "ai:cloud").is_err());
        assert!(validate("cn.neurou.app", "").is_err());
        assert!(validate("cn.neurou.app", "a\nb").is_err());
    }
}
