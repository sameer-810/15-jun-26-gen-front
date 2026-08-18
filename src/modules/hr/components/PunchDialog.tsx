import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { usePunch } from "../hooks/useHr";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";

/**
 * Photo capture for attendance (SRS 3.1).
 *
 * Three things this deliberately does not do:
 *
 *  - **It does not ask which direction the punch is.** The server derives that
 *    from the day so far, so a retried request on a flaky site connection can
 *    never open a shift nobody intended.
 *  - **It does not block on location.** Geolocation is requested alongside the
 *    camera and whatever arrives is sent; a refusal or a timeout is not an
 *    error. Field staff work in sheds, and a location gate would lock out
 *    exactly the people who need this to work.
 *  - **It does not retry silently.** If the upload fails the captured frame
 *    stays on screen so the user can send it again, rather than losing the photo
 *    and having to re-pose.
 */
export function PunchDialog({
  open,
  direction,
  onClose,
}: {
  open: boolean;
  direction: "in" | "out";
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracyM: number } | null>(
    null,
  );
  const punchMutation = usePunch();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `user` is the selfie camera — this is a photo of the person, not of
          // what they are looking at.
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setCameraError(
            "No camera available. Allow camera access in your browser, then try again.",
          );
        }
      }
    }
    start();

    // Requested in parallel and entirely optional — see the note above.
    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        !cancelled &&
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open) {
      setShot(null);
      setCameraError(null);
      setCoords(null);
    }
  }, [open]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // 0.7 keeps a recognisable face well under the server's size cap.
    setShot(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
  }

  async function submit() {
    if (!shot) return;
    try {
      await punchMutation.mutateAsync({ photoBase64: shot, ...(coords ?? {}) });
      toast.success(direction === "in" ? "Logged in" : "Logged out");
      onClose();
    } catch (err) {
      // The frame is kept on purpose so they can send it again.
      toast.error(getApiErrorMessage(err));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="pg-overlay w-full max-w-md p-5" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {direction === "in" ? "Log in for the day" : "Log out for the day"}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Take a photo to record your attendance.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-muted">
          {cameraError ? (
            <p className="p-6 text-center text-sm text-destructive">{cameraError}</p>
          ) : shot ? (
            <img src={shot} alt="Attendance capture" className="w-full" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              // Mirrored so it behaves like a mirror while you frame yourself.
              className="w-full -scale-x-100"
            />
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {coords
            ? `Location captured (±${Math.round(coords.accuracyM)}m)`
            : "Location unavailable — your photo and time are still recorded."}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          {shot ? (
            <>
              <button
                data-testid="punch-retake"
                onClick={() => {
                  setShot(null);
                  setCameraError(null);
                  // Re-open the stream for another attempt.
                  navigator.mediaDevices
                    ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
                    .then((s) => {
                      streamRef.current = s;
                      if (videoRef.current) videoRef.current.srcObject = s;
                    })
                    .catch(() => setCameraError("Camera unavailable. Reload and try again."));
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </button>
              <button
                data-testid="punch-submit"
                onClick={submit}
                disabled={punchMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {punchMutation.isPending
                  ? "Recording…"
                  : direction === "in"
                    ? "Confirm log in"
                    : "Confirm log out"}
              </button>
            </>
          ) : (
            <button
              data-testid="punch-capture"
              onClick={capture}
              disabled={Boolean(cameraError)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Take photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
