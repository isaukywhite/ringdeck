use crate::config::ActionConfig;
use std::process::Command;

pub fn execute(action: &ActionConfig) -> Result<(), String> {
    match action {
        ActionConfig::Script { command } => {
            Command::new("sh")
                .arg("-c")
                .arg(command)
                .spawn()
                .map_err(|e| format!("Failed to run script: {}", e))?;
        }
        ActionConfig::Program { path, args } => {
            // If path is a .app bundle, launch via `open`
            if path.ends_with(".app") {
                let mut cmd = Command::new("open");
                cmd.arg("-a").arg(path);
                if !args.is_empty() {
                    cmd.arg("--args");
                    cmd.args(args);
                }
                cmd.spawn()
                    .map_err(|e| format!("Failed to open app: {}", e))?;
            } else {
                Command::new(path)
                    .args(args)
                    .spawn()
                    .map_err(|e| format!("Failed to launch program: {}", e))?;
            }
        }
        ActionConfig::System { action } => {
            eprintln!("System action not yet implemented: {}", action);
        }
    }
    Ok(())
}
