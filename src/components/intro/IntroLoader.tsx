import { useEffect, useRef, useState } from "react";
import { PlayIcon, CloseIcon } from "@/components/icons/Icons";
import "./IntroLoader.css";

interface IntroLoaderProps {
  onFinish: () => void;
}

export function IntroLoader({ onFinish }: { onFinish: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  const handleSkip = () => {
    onFinish();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", onFinish);

    video.play().catch(() => {
      // Autoplay with sound might need user interaction; muted play as fallback
      video.muted = true;
      video.play().catch(onFinish);
    });

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", onFinish);
    };
  }, [onFinish]);

  return (
    <div
      className="momo-intro-backdrop"
      data-tauri-drag-region
      onMouseDown={(e) => {
        if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
          import("@tauri-apps/api/window").then((w) => w.getCurrentWindow().startDragging()).catch(() => {});
        }
      }}
    >
      <div className="momo-intro-card liquid-glass-card">
        <header
          className="momo-intro-header"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
              import("@tauri-apps/api/window").then((w) => w.getCurrentWindow().startDragging()).catch(() => {});
            }
          }}
        >
          <img src="/logo.png" alt="Momo Logo" className="momo-intro-logo" data-tauri-drag-region />
          <div className="momo-intro-titles" data-tauri-drag-region>
            <h2 data-tauri-drag-region>Momo</h2>
            <p data-tauri-drag-region>Your AI Desktop Companion</p>
          </div>
          <button className="liquid-glass-btn momo-intro-skip-btn" onClick={handleSkip}>
            Skip <CloseIcon size={14} />
          </button>
        </header>

        <div className="momo-intro-video-wrapper">
          <video
            ref={videoRef}
            src="/intro.mp4"
            className="momo-intro-video"
            playsInline
            autoPlay
          />
        </div>

        <div className="momo-intro-progress-bar">
          <div className="momo-intro-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
