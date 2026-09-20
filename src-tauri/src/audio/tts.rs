use tts::Tts;

/// Speaks `text` using the OS's default voice (Windows SAPI / macOS
/// AVSpeechSynthesizer / Linux speech-dispatcher, depending on platform).
///
/// This runs on its own throwaway OS thread rather than a shared/pooled
/// one: some TTS backends (notably Windows SAPI, which is COM-based) are
/// picky about which thread they're created and used from, so the
/// simplest reliable approach is "one thread per utterance, created fresh,
/// dropped when done". `volume` is 0.0-1.0, `rate` is a multiplier where
/// 1.0 is the voice's normal speed (0.5 = half speed, 2.0 = double).
///
/// This is deliberately fire-and-forget from the caller's perspective - a
/// TTS failure should never block or crash the chat.
pub fn speak(text: String, volume: f32, rate: f32) {
    std::thread::spawn(move || {
        if let Err(e) = speak_blocking(&text, volume, rate) {
            log::warn!("TTS failed: {e}");
        }
    });
}

fn speak_blocking(text: &str, volume: f32, rate: f32) -> Result<(), tts::Error> {
    let mut engine = Tts::default()?;
    let features = engine.supported_features();

    if features.volume {
        let _ = engine.set_volume(volume.clamp(0.0, 1.0));
    }
    if features.rate {
        let normal = engine.normal_rate();
        let min = engine.min_rate();
        let max = engine.max_rate();
        let target = if rate >= 1.0 {
            normal + (rate - 1.0).min(1.0) * (max - normal)
        } else {
            normal - (1.0 - rate).min(1.0) * (normal - min)
        };
        let _ = engine.set_rate(target);
    }

    engine.speak(text, true)?;

    // Keep this thread (and the engine) alive until speech actually
    // finishes, or a generous timeout elapses - whichever comes first.
    // Dropping the engine mid-utterance can cut audio off on some backends.
    if features.is_speaking {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
        loop {
            std::thread::sleep(std::time::Duration::from_millis(120));
            match engine.is_speaking() {
                Ok(true) if std::time::Instant::now() < deadline => continue,
                _ => break,
            }
        }
    } else {
        // No way to poll completion - estimate ~14 characters/second and
        // wait that long, capped so a huge message can't hang the thread.
        let estimated_secs = (text.chars().count() as f32 / 14.0 / rate.max(0.25)).clamp(1.0, 30.0);
        std::thread::sleep(std::time::Duration::from_secs_f32(estimated_secs));
    }

    Ok(())
}
