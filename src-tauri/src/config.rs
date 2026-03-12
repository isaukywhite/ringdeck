use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RingConfig {
    pub shortcut: String,
    pub slices: Vec<SliceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SliceConfig {
    pub label: String,
    pub icon: String,
    pub action: ActionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ActionConfig {
    Script { command: String },
    Program { path: String, args: Vec<String> },
    System { action: String },
}

impl Default for RingConfig {
    fn default() -> Self {
        Self {
            shortcut: "Alt+Space".to_string(),
            slices: vec![
                SliceConfig {
                    label: "Terminal".to_string(),
                    icon: "terminal".to_string(),
                    action: ActionConfig::Program {
                        path: "open".to_string(),
                        args: vec!["-a".to_string(), "Terminal".to_string()],
                    },
                },
                SliceConfig {
                    label: "Browser".to_string(),
                    icon: "globe".to_string(),
                    action: ActionConfig::Program {
                        path: "open".to_string(),
                        args: vec!["-a".to_string(), "Safari".to_string()],
                    },
                },
            ],
        }
    }
}

fn config_path(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&dir).ok();
    dir.join("config.json")
}

pub fn load_config(app: &AppHandle) -> RingConfig {
    let path = config_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        let config = RingConfig::default();
        save_config_to_disk(app, &config).ok();
        config
    }
}

pub fn save_config_to_disk(app: &AppHandle, config: &RingConfig) -> Result<(), String> {
    let path = config_path(app);
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}
