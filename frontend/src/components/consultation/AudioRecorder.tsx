import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function formatMs(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({
  disabled,
  onReady,
}: {
  disabled?: boolean;
  onReady: (blob: Blob, filename: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
    }, 200);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        onReady(blob, `consult-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      recorder.start(250);
      setRecording(true);
      setPaused(false);
      startTimer();
    } catch {
      setError("Microphone access denied or unavailable. Use file upload instead.");
    }
  }

  function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    accumulatedRef.current += Date.now() - startedAtRef.current;
    clearTimer();
    setPaused(true);
  }

  function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    startedAtRef.current = Date.now();
    recorder.resume();
    setPaused(false);
    startTimer();
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      accumulatedRef.current += Date.now() - startedAtRef.current;
    }
    clearTimer();
    setElapsedMs(accumulatedRef.current);
    recorder.stop();
    setRecording(false);
    setPaused(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Mic className={`size-4 ${recording && !paused ? "text-destructive" : "text-muted-foreground"}`} />
          <span className="font-mono tabular-nums">{formatMs(elapsedMs)}</span>
          {recording ? (
            <span className="text-xs text-muted-foreground">{paused ? "Paused" : "Recording…"}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Ready</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <Button type="button" size="sm" disabled={disabled} onClick={() => void startRecording()}>
              <Play className="mr-1.5 size-3.5" />
              Start
            </Button>
          ) : (
            <>
              {paused ? (
                <Button type="button" size="sm" variant="outline" onClick={resumeRecording}>
                  <Play className="mr-1.5 size-3.5" />
                  Resume
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={pauseRecording}>
                  <Pause className="mr-1.5 size-3.5" />
                  Pause
                </Button>
              )}
              <Button type="button" size="sm" variant="destructive" onClick={stopRecording}>
                <Square className="mr-1.5 size-3.5" />
                Stop & use
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Upload className="size-4 text-muted-foreground" />
        <Input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
          disabled={disabled || recording}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onReady(file, file.name);
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
