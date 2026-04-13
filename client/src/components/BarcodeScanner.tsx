import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, X, AlertCircle, Loader2 } from "lucide-react";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (code: string) => void;
}

const BARCODE_FORMATS = [
  "ean_13", "ean_8", "code_128", "code_39",
  "code_93", "qr_code", "upc_a", "upc_e", "itf", "codabar",
];

export default function BarcodeScanner({
  isOpen,
  onClose,
  onBarcodeDetected,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasNativeDetector, setHasNativeDetector] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);

  // ---- limpieza ----
  const stopAll = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
      try { videoRef.current.srcObject = null; } catch (_) {}
    }
    detectorRef.current = null;
  }, []);

  // ---- loop de detección ----
  const runDetectionLoop = useCallback(() => {
    const detect = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          const code = barcodes[0].rawValue;
          stopAll();
          setDetectedCode(code);
          onBarcodeDetected(code);
          return;
        }
      } catch (_) {}
      animFrameRef.current = requestAnimationFrame(detect);
    };
    animFrameRef.current = requestAnimationFrame(detect);
  }, [onBarcodeDetected, stopAll]);

  // ---- iniciar cámara ----
  const startCamera = useCallback(async () => {
    stopAll();
    setLoading(true);
    setError(null);
    setDetectedCode(null);
    setScanning(false);

    // Verificar soporte de BarcodeDetector
    const nativeSupported =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window;
    setHasNativeDetector(nativeSupported);

    // Si no hay soporte nativo, abrir cámara igualmente para mostrar video
    // pero el usuario deberá ingresar el código manualmente
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;

      // Esperar a que el elemento video esté listo en el DOM
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const video = videoRef.current;
      if (!video) {
        setError("Error interno: elemento de video no disponible.");
        setLoading(false);
        return;
      }

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        const onMeta = () => { video.removeEventListener("loadedmetadata", onMeta); resolve(); };
        video.addEventListener("loadedmetadata", onMeta);
        // timeout de seguridad
        setTimeout(resolve, 3000);
      });

      try { await video.play(); } catch (_) {}

      setLoading(false);

      if (nativeSupported) {
        // Intentar obtener formatos soportados y filtrar los disponibles
        let formats = BARCODE_FORMATS;
        try {
          const supported = await (window as any).BarcodeDetector.getSupportedFormats();
          formats = BARCODE_FORMATS.filter((f) => supported.includes(f));
          if (formats.length === 0) formats = BARCODE_FORMATS;
        } catch (_) {}

        detectorRef.current = new (window as any).BarcodeDetector({ formats });
        setScanning(true);
        runDetectionLoop();
      } else {
        // Sin soporte nativo: mostrar input manual, el video sigue visible
        setScanning(false);
        setTimeout(() => manualInputRef.current?.focus(), 300);
      }
    } catch (err: any) {
      setLoading(false);
      setScanning(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Permiso de cámara denegado. Habilita la cámara en la configuración del navegador.");
      } else if (err?.name === "NotFoundError") {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setError("No se pudo acceder a la cámara. Verifica que no esté en uso por otra app.");
      }
      // Aun con error de cámara, permitir ingreso manual
      setTimeout(() => manualInputRef.current?.focus(), 300);
    }
  }, [runDetectionLoop, stopAll]);

  // ---- cerrar ----
  const handleClose = useCallback(() => {
    stopAll();
    setDetectedCode(null);
    setError(null);
    setScanning(false);
    setLoading(false);
    onClose();
  }, [stopAll, onClose]);

  const handleManualSubmit = useCallback(
    (value: string) => {
      const code = value.trim();
      if (!code) return;
      stopAll();
      onBarcodeDetected(code);
      onClose();
    },
    [onBarcodeDetected, onClose, stopAll]
  );

  // ---- efecto principal ----
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopAll();
    }
    return () => stopAll();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Escanear Código de Barras
          </DialogTitle>
          <DialogDescription>
            {hasNativeDetector
              ? "Apunta la cámara al código de barras"
              : "Escanea manualmente o ingresa el código"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-4 pb-4">

          {/* Error de cámara */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cargando */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Iniciando cámara...</p>
              </div>
            </div>
          )}

          {/* Vista de video - SIEMPRE montada para que el ref exista */}
          <div
            className="w-full bg-black rounded-lg overflow-hidden relative"
            style={{ minHeight: loading ? 0 : "280px", display: loading ? "none" : "block" }}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              style={{ display: "block", minHeight: "280px" }}
            />

            {/* Marco de escaneo */}
            {scanning && !loading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-40">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/70 animate-pulse" />
                </div>
              </div>
            )}

            {/* Etiqueta de modo sin soporte */}
            {!hasNativeDetector && !loading && !error && (
              <div className="absolute bottom-2 inset-x-0 flex justify-center">
                <span className="bg-black/60 text-yellow-300 text-xs px-2 py-1 rounded">
                  Detección automática no disponible en este navegador
                </span>
              </div>
            )}
          </div>

          {/* Código detectado */}
          {detectedCode && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Código detectado: <strong>{detectedCode}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Input manual - visible si no hay soporte nativo o si hubo error */}
          {(!hasNativeDetector || error) && !loading && (
            <div className="space-y-1">
              <p className="text-sm text-gray-600 font-medium">
                {error ? "Ingresa el código manualmente:" : "O ingresa el código manualmente:"}
              </p>
              <div className="flex gap-2">
                <input
                  ref={manualInputRef}
                  id="manual-barcode-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 7802910000000"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualSubmit((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById("manual-barcode-input") as HTMLInputElement | null;
                    handleManualSubmit(el?.value ?? "");
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          )}

          {/* Estado */}
          {!loading && !error && hasNativeDetector && (
            <p className="text-center text-xs text-gray-400">
              {scanning ? "Escaneando... apunta al código" : "Iniciando detector..."}
            </p>
          )}

          {/* Botón cerrar */}
          <Button onClick={handleClose} variant="outline" className="w-full">
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
