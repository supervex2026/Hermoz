// Prevents an extra console window from popping up on Windows in release
// builds. Debug builds keep the console so `println!`/`log` output is
// visible while developing.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    hermoz_lib::run();
}
