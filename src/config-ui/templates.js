export const SUBMENU_TEMPLATES = [
  {
    name: "\u{1F310} Browsers",
    icon: "globe-alt",
    slices: [
      { label: "Chrome", icon: "globe-alt", action: { type: "Program", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", args: [] } },
      { label: "Edge", icon: "globe-alt", action: { type: "Program", path: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", args: [] } },
      { label: "Firefox", icon: "globe-alt", action: { type: "Program", path: "C:\\Program Files\\Mozilla Firefox\\firefox.exe", args: [] } },
      { label: "Opera", icon: "globe-alt", action: { type: "Program", path: "C:\\Users\\AppData\\Local\\Programs\\Opera\\opera.exe", args: [] } },
    ]
  },
  {
    name: "\u{1F916} IA Web",
    icon: "cpu-chip",
    slices: [
      { label: "Gemini", icon: "sparkles", action: { type: "Script", command: "start https://gemini.google.com" } },
      { label: "Claude", icon: "chat-bubble-left-right", action: { type: "Script", command: "start https://claude.ai" } },
      { label: "Copilot", icon: "sparkles", action: { type: "Script", command: "start https://copilot.microsoft.com" } },
      { label: "Perplexity", icon: "magnifying-glass", action: { type: "Script", command: "start https://perplexity.ai" } },
      { label: "DeepSeek", icon: "cpu-chip", action: { type: "Script", command: "start https://chat.deepseek.com" } },
      { label: "Manus", icon: "cpu-chip", action: { type: "Script", command: "start https://manus.im" } },
    ]
  },
  {
    name: "\u{1F3B5} M\u00EDdia",
    icon: "play",
    slices: [
      { label: "Play/Pause", icon: "play-pause", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB3,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB3,0,2,[UIntPtr]::Zero)" } },
      { label: "Next Track", icon: "forward", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB0,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB0,0,2,[UIntPtr]::Zero)" } },
      { label: "Prev Track", icon: "backward", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB1,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB1,0,2,[UIntPtr]::Zero)" } },
      { label: "Vol Up", icon: "speaker-wave", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAF,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAF,0,2,[UIntPtr]::Zero)" } },
      { label: "Vol Down", icon: "speaker-wave", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAE,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAE,0,2,[UIntPtr]::Zero)" } },
      { label: "Mute", icon: "speaker-x-mark", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAD,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAD,0,2,[UIntPtr]::Zero)" } },
    ]
  },
  {
    name: "\u{1F4DD} LibreOffice",
    icon: "document-text",
    slices: [
      { label: "Writer", icon: "document-text", action: { type: "Program", path: "C:\\Program Files\\LibreOffice\\program\\swriter.exe", args: [] } },
      { label: "Calc", icon: "table-cells", action: { type: "Program", path: "C:\\Program Files\\LibreOffice\\program\\scalc.exe", args: [] } },
      { label: "Impress", icon: "presentation-chart-bar", action: { type: "Program", path: "C:\\Program Files\\LibreOffice\\program\\simpress.exe", args: [] } },
      { label: "Draw", icon: "paint-brush", action: { type: "Program", path: "C:\\Program Files\\LibreOffice\\program\\sdraw.exe", args: [] } },
    ]
  },
  {
    name: "\u{1F4BB} IA CLI",
    icon: "command-line",
    slices: [
      { label: "Gemini CLI", icon: "command-line", action: { type: "Script", command: "start cmd /k gemini" } },
      { label: "Claude Code", icon: "command-line", action: { type: "Script", command: "start cmd /k claude" } },
      { label: "Codex", icon: "command-line", action: { type: "Script", command: "start cmd /k codex" } },
      { label: "Aider", icon: "command-line", action: { type: "Script", command: "start cmd /k aider" } },
    ]
  }
];
