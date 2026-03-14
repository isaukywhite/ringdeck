param([int]$vk)
Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport("user32.dll")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}'
[MK]::keybd_event($vk,0,0,[UIntPtr]::Zero)
[MK]::keybd_event($vk,0,2,[UIntPtr]::Zero)
