import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api/supabaseClient";
import { useTranslation } from "@/i18n";
import { X, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, Plus, Camera, Search, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function BarcodeScanner({ open, onClose, onApply, recipientId }) {
  const t = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const loopRef = useRef(null);
  const foundRef = useRef(false);
  const galleryRef = useRef(null);

  const [phase, setPhase] = useState("camera"); // camera | decoding | looking | preview | notfound
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [unsupported, setUnsupported] = useState(false);

  const stopCamera = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const logScan = (code, method, data) =>
    api.entities.ScanHistory.create({
      barcode: code,
      detection_method: method,
      found: !!data?.found,
      product_kind: data?.kind || "unknown",
      product_name: data?.name || "",
      manufacturer: data?.manufacturer || "",
      api_source: data?.source || "",
      recipient_id: recipientId || "",
    }).catch((e) => console.error("ScanHistory error:", e));

  const handleFound = useCallback(
    async (code, method) => {
      stopCamera();
      setBarcode(code);
      setPhase("looking");
      try {
        const res = await api.functions.invoke("lookup-barcode", { barcode: code });
        const data = res.data;
        if (!data || data.error) throw new Error(data?.error || "lookup failed");
        await logScan(code, method, data);
        if (data.found) {
          setProduct(data);
          setPhase("preview");
        } else {
          setPhase("notfound");
        }
      } catch (err) {
        console.error("Barcode lookup error:", err);
        await logScan(code, method, null);
        setError(t("barcode.lookupFailed"));
        setPhase("notfound");
      }
    },
    [stopCamera, t, recipientId]
  );

  const startCamera = useCallback(async () => {
    setError("");
    setProduct(null);
    setBarcode("");
    foundRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setUnsupported(true);
        setPhase("camera");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window;
      setUnsupported(!hasDetector);
      if (!hasDetector) {
        setPhase("camera");
        return;
      }

      let options;
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats?.();
        const wanted = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"].filter(
          (f) => !supported || supported.includes(f)
        );
        options = wanted.length ? { formats: wanted } : undefined;
      } catch {
        options = undefined;
      }
      detectorRef.current = options ? new window.BarcodeDetector(options) : new window.BarcodeDetector();

      setPhase("camera");
      loopRef.current = setInterval(async () => {
        if (!detectorRef.current || !videoRef.current || foundRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            foundRef.current = true;
            handleFound(String(codes[0].rawValue), "barcode_detector");
          }
        } catch {
          /* ignore per-frame detection errors */
        }
      }, 500);
    } catch (err) {
      console.error("Barcode camera error:", err);
      setUnsupported(true);
      setError(err?.name === "NotAllowedError" ? t("barcode.cameraDenied") : t("barcode.cameraUnavailable"));
    }
  }, [handleFound, t]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
     
  }, [open]);

  const handlePhoto = async (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(t("scan.fileTooLarge"));
      return;
    }
    setPhase("decoding");
    setError("");
    try {
      const { file_uri } = await api.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await api.integrations.Core.CreateFileSignedUrl({ file_uri });
      const res = await api.functions.invoke("read-barcode-image", { imageUrl: signed_url });
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "decode failed");
      if (!data.readable || !data.barcode) {
        setError(t("barcode.unreadable"));
        setPhase("camera");
        return;
      }
      stopCamera();
      await handleFound(String(data.barcode), "image_scan");
    } catch (err) {
      console.error("Barcode image decode error:", err);
      setError(t("barcode.unreadable"));
      setPhase("camera");
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) handlePhoto(new File([blob], `barcode_${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  const handleGallery = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handlePhoto(file);
  };

  if (!open) return null;

  const kindLabel =
    product?.kind === "medicine" ? t("barcode.kindMedicine") : product?.kind === "other" ? t("barcode.kindOther") : t("barcode.kindUnknown");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card rounded-2xl border-2 border-border w-full max-w-md max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent/10 text-accent shrink-0">
            <ScanBarcode className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading font-bold text-sm text-foreground">{t("barcode.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("barcode.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl border-2 border-border text-muted-foreground hover:bg-muted transition-colors shrink-0"
            aria-label={t("barcode.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-alert/10 text-alert text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {(phase === "camera" || phase === "decoding") && (
            <>
              <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[85%] h-[45%] border-2 border-white/50 rounded-xl" />
                </div>
                {!unsupported && (
                  <p className="absolute top-3 inset-x-3 text-center text-xs text-white/80">{t("barcode.scanning")}</p>
                )}
                {phase === "decoding" && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <p className="text-xs text-white">{t("barcode.decoding")}</p>
                  </div>
                )}
              </div>

              {unsupported && (
                <div className="p-3 rounded-xl bg-warning/10 border-2 border-warning/30">
                  <p className="text-xs font-semibold text-warning">{t("barcode.unsupported")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("barcode.unsupportedDesc")}</p>
                </div>
              )}

              {!unsupported && <p className="text-xs text-muted-foreground text-center">{t("barcode.hint")}</p>}

              <div className="flex gap-2">
                <button
                  onClick={captureFromVideo}
                  disabled={phase === "decoding"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 touch-target"
                >
                  <Camera className="w-4 h-4" />
                  {t("barcode.capturePhoto")}
                </button>
                <button
                  onClick={() => galleryRef.current?.click()}
                  disabled={phase === "decoding"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50 touch-target"
                >
                  <ImageIcon className="w-4 h-4" />
                  {t("barcode.gallery")}
                </button>
              </div>
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleGallery} />
            </>
          )}

          {phase === "looking" && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-sm font-medium text-foreground">{t("barcode.looking")}</p>
              {barcode && <p className="text-xs text-muted-foreground tabular-nums">{barcode}</p>}
            </div>
          )}

          {phase === "preview" && product && (
            <>
              <div className="p-4 rounded-2xl bg-secondary/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-base text-foreground">{product.name}</p>
                    {product.generic_name && <p className="text-xs text-muted-foreground">{product.generic_name}</p>}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold",
                      product.kind === "medicine" ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"
                    )}
                  >
                    {kindLabel}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="tabular-nums">{product.barcode}</p>
                  {product.manufacturer && <p>{t("barcode.manufacturer")}: {product.manufacturer}</p>}
                  {product.strength && <p>{t("barcode.strength")}: {product.strength}</p>}
                  {product.dosage_form && <p>{t("barcode.dosageForm")}: {product.dosage_form}</p>}
                </div>
              </div>

              {product.kind !== "medicine" && (
                <div className="p-3 rounded-xl bg-warning/10 border-2 border-warning/30 text-xs text-warning flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {t("barcode.notMedicineWarning")}
                </div>
              )}

              <button
                onClick={() => onApply(product, product.barcode || barcode)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors touch-target"
              >
                <Plus className="w-4 h-4" />
                {t("barcode.addAsMedication")}
              </button>
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors touch-target"
              >
                <RefreshCw className="w-4 h-4" />
                {t("barcode.rescan")}
              </button>
            </>
          )}

          {phase === "notfound" && (
            <>
              <div className="text-center py-6">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary mx-auto mb-3">
                  <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-heading font-bold text-sm text-foreground mb-1">{t("barcode.notFound")}</p>
                <p className="text-xs text-muted-foreground">{t("barcode.notFoundDesc")}</p>
                {barcode && <p className="text-xs text-muted-foreground mt-2 tabular-nums">{barcode}</p>}
              </div>
              <button
                onClick={() => onApply(null, barcode)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors touch-target"
              >
                <Plus className="w-4 h-4" />
                {t("barcode.manualEntry")}
              </button>
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors touch-target"
              >
                <RefreshCw className="w-4 h-4" />
                {t("barcode.rescan")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}