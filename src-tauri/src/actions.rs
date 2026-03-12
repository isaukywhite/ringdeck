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
            Command::new(path)
                .args(args)
                .spawn()
                .map_err(|e| format!("Failed to launch program: {}", e))?;
        }
        ActionConfig::System { action } => {
            // System actions can be extended later
            eprintln!("System action not yet implemented: {}", action);
        }
    }
    Ok(())
}
