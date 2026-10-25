// TRADECRAFT: read or set the built-in display's backlight (0–1), for tools/awake.sh.
//
//   bright          print the current level
//   bright 0.6      set it
//
// Through the private DisplayServices framework, which needs no accessibility
// permission (AppleScript's key codes would). awake.sh builds it on first use
// into .run/awake/bright; nothing else depends on it.
import Foundation
import CoreGraphics

typealias GetF = @convention(c) (UInt32, UnsafeMutablePointer<Float>) -> Int32
typealias SetF = @convention(c) (UInt32, Float) -> Int32

guard let h = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_NOW),
      let g = dlsym(h, "DisplayServicesGetBrightness"),
      let s = dlsym(h, "DisplayServicesSetBrightness") else {
  FileHandle.standardError.write("DisplayServices unavailable\n".data(using: .utf8)!)
  exit(1)
}
let get = unsafeBitCast(g, to: GetF.self)
let set = unsafeBitCast(s, to: SetF.self)
let display = CGMainDisplayID()

if CommandLine.arguments.count > 1, let v = Float(CommandLine.arguments[1]) {
  exit(set(display, max(0, min(1, v))) == 0 ? 0 : 1)
}
var level: Float = -1
if get(display, &level) != 0 { exit(1) }
print(level)
