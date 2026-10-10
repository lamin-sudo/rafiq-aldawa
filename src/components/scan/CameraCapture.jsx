import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Image as ImageIcon, X, RefreshCw, Check, SwitchCamera, AlertCircle } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function CameraCapture({ onCapture, onCancel, t }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("camera_unavailable");
        return;
      }
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("camera_denied");
      } else {
        setError("camera_unavailable");
      }
      setStreaming(false);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!capturedFile) startCamera();
    return () => stopStream();
     
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  const capturePhoto = () => {
    if (!videoRef.current || !streaming) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
          setCapturedFile(file);
          setCapturedUrl(URL.createObjectURL(file));
          stopStream();
          setStreaming(false);
        }
      },
      "image/jpeg",
      0.85
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("file_too_large");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("camera_unavailable");
      return;
    }
    setCapturedFile(file);
    setCapturedUrl(URL.createObjectURL(file));
    stopStream();
    setStreaming(false);
    e.target.value = "";
  };

  const retake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedFile(null);
    setCapturedUrl(null);
    setError("");
    startCamera();
  };

  const confirm = () => {
    if (capturedFile) onCapture(capturedFile);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Error / fallback state
  if (error === "camera_denied" || error === "camera_unavailable" || error === "file_too_large") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-secondary">
          {error === "file_too_large" ? (
            <AlertCircle className="w-8 h-8 text-warning" />
          ) : (
            <Camera className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          {error === "camera_denied"
            ? t("scan.cameraDenied")
            : error === "file_too_large"
            ? t("scan.fileTooLarge")
            : t("scan.cameraUnavailable")}
        </p>
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors touch-target"
        >
          <ImageIcon className="w-5 h-5" />
          {t("scan.chooseFromGallery")}
        </button>
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
          {t("common.cancel")}
        </button>
      </div>
    );
  }

  // Captured preview state
  if (capturedFile) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4]">
          <img src={capturedUrl} alt="captured" className="w-full h-full object-contain" />
        </div>
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-accent" />
          {t("scan.photoStoredPrivately")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={retake}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-border text-muted-foreground font-medium text-sm hover:bg-muted transition-colors touch-target"
          >
            <RefreshCw className="w-4 h-4" />
            {t("scan.retake")}
          </button>
          <button
            onClick={confirm}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors touch-target"
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
            {t("scan.usePhoto")}
          </button>
        </div>
      </div>
    );
  }

  // Live camera state
  return (
    <div className="relative">
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4]">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {/* Guide frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] h-[65%] border-2 border-white/50 rounded-2xl" />
        </div>
        <p className="absolute top-3 inset-x-3 text-center text-xs text-white/80">{t("scan.scanHint")}</p>

        {/* Top controls */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white touch-target"
            aria-label={t("common.cancel")}
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={switchCamera}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/50 text-white touch-target"
            aria-label={t("scan.cameraSwitch")}
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-8">
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-black/50 text-white touch-target"
            aria-label={t("scan.chooseFromGallery")}
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            onClick={capturePhoto}
            disabled={!streaming}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-white ring-4 ring-white/30 disabled:opacity-50 touch-target transition-transform active:scale-95"
            aria-label={t("scan.capture")}
          >
            <div className="w-12 h-12 rounded-full bg-white border-4 border-gray-300" />
          </button>
          <div className="w-12 h-12" />
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>
    </div>
  );
}