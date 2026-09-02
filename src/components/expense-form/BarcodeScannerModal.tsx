import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from "@zxing/library";

import { Button } from "@/components/ui/button";

interface BarcodeScannerModalProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScannerModal({ onScan, onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [zoomCapable, setZoomCapable] = useState(false);
  const [zoomConfig, setZoomConfig] = useState({ min: 1, max: 1, step: 0.1, current: 1 });
  const [scanState, setScanState] = useState<"scanning" | "found">("scanning");
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let reader: BrowserMultiFormatReader | null = null;
    let isMounted = true;

    async function startScanner() {
      try {
        const hints = new Map();
        const formats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.QR_CODE
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        
        // Let's try 300ms to avoid locking the UI, but still scan fast
        reader = new BrowserMultiFormatReader(hints, 300);
        
        // Request the highest possible standard resolution for mobile
        const constraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30 },
            advanced: [{ focusMode: "continuous" }]
          }
        } as any;

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.() || {};
          const settings = videoTrack.getSettings?.() || {};
          
          setDebugInfo({
            reqWidth: constraints.video.width.ideal,
            reqHeight: constraints.video.height.ideal,
            actualWidth: settings.width,
            actualHeight: settings.height,
            fps: settings.frameRate,
            facingMode: settings.facingMode,
            focusMode: (settings as any).focusMode || "N/A",
            hasZoom: !!(capabilities as any).zoom,
            detector: "Initializing..."
          });

          if ((capabilities as any).zoom) {
            setZoomCapable(true);
            setZoomConfig({
              min: (capabilities as any).zoom.min || 1,
              max: (capabilities as any).zoom.max || 5,
              step: (capabilities as any).zoom.step || 0.1,
              current: (settings as any).zoom || (capabilities as any).zoom.min || 1,
            });
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.style.objectFit = "cover";
          await videoRef.current.play();

          // ---- DETECTION LOGIC ----
          // Attempt to use native BarcodeDetector for ML-Kit/Vision level performance
          let nativeDetector: any = null;
          if ('BarcodeDetector' in window) {
            try {
              // @ts-ignore
              const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
              setDebugInfo((prev: any) => ({ 
                ...prev, 
                nativeFormats: supportedFormats.join(', '),
                detector: supportedFormats.includes('ean_13') ? "Native (BarcodeDetector)" : "ZXing (Fallback)"
              }));
              
              if (supportedFormats.includes('ean_13')) {
                // @ts-ignore
                nativeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_128'] });
              }
            } catch (e) {
              console.warn("Native BarcodeDetector failed to initialize", e);
            }
          } else {
            setDebugInfo((prev: any) => ({ ...prev, detector: "ZXing (Native Not Supported)" }));
          }

          let scanLoopRunning = true;
          let isProcessingFrame = false;

          const handleDetection = (resultStr: string, format: string) => {
            if (!isMounted || scanState === "found") return;
            
            // Basic EAN-13 validation if format is explicitly EAN-13
            if (format.toLowerCase().includes('ean_13') || format.toLowerCase().includes('ean-13')) {
               if (!/^\d{13}$/.test(resultStr)) {
                  console.warn("Detected EAN-13 but failed validation (not 13 digits):", resultStr);
                  return;
               }
            }

            scanLoopRunning = false;
            setScanState("found");
            setDebugInfo((prev: any) => ({ ...prev, lastDetectedFormat: format, lastDetectedValue: resultStr }));

            if (navigator.vibrate) navigator.vibrate(100);
            
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (reader) reader.reset();
            
            setTimeout(() => onScan(resultStr), 400);
          };

          const scanLoop = async () => {
            if (!isMounted || !scanLoopRunning || !videoRef.current) return;
            
            if (isProcessingFrame) {
              requestAnimationFrame(scanLoop);
              return;
            }

            isProcessingFrame = true;

            try {
              if (nativeDetector && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await nativeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  handleDetection(barcodes[0].rawValue, barcodes[0].format);
                  return; // Stop loop
                }
              } else if (reader && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                // ZXing fallback
                const result = await reader.decodeFromVideoElement(videoRef.current);
                if (result) {
                  handleDetection(result.getText(), result.getBarcodeFormat().toString());
                  return; // Stop loop
                }
              }
            } catch (err: any) {
              // Ignore NotFoundException from ZXing, it just means no barcode in this frame
              if (err && err.name !== 'NotFoundException') {
                console.debug("Detection error in frame:", err);
              }
            } finally {
              isProcessingFrame = false;
            }

            if (scanLoopRunning) {
              // Small timeout for ZXing to prevent main thread lockup, Native can run faster
              const delay = nativeDetector ? 30 : 100;
              setTimeout(() => {
                if (scanLoopRunning) requestAnimationFrame(scanLoop);
              }, delay);
            }
          };

          requestAnimationFrame(scanLoop);

          // Cleanup ZXing continuous if it was running (we aren't using decodeFromVideoElementContinuously anymore)
        }

      } catch (err: any) {
        if (!isMounted) return;
        console.error("Camera access error:", err);
        if (err.name === 'NotAllowedError') {
          setError("Não foi possível acessar a câmera. Permita o acesso à câmera nas configurações do navegador para usar o leitor.");
        } else if (err.name === 'NotFoundError') {
          setError("Nenhuma câmera encontrada no dispositivo.");
          setHasCamera(false);
        } else if (err.name === 'OverconstrainedError') {
          // Fallback logic
          try {
             const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
             streamRef.current = fallbackStream;
             const track = fallbackStream.getVideoTracks()[0];
             if (track) {
               setDebugInfo({
                 note: "Fallback used (OverconstrainedError)",
                 actualWidth: track.getSettings().width,
                 actualHeight: track.getSettings().height,
                 fps: track.getSettings().frameRate
               });
             }
             if (videoRef.current) {
               videoRef.current.srcObject = fallbackStream;
               videoRef.current.setAttribute("playsinline", "true");
               await videoRef.current.play();
               
               if (reader) {
                 reader.decodeFromVideoElementContinuously(videoRef.current, (result, err) => {
                   if (result && isMounted && scanState === "scanning") {
                     setScanState("found");
                     setDebugInfo((prev: any) => ({ ...prev, lastDetectedFormat: "ZXing (Fallback)", lastDetectedValue: result.getText() }));
                     if (navigator.vibrate) navigator.vibrate(100);
                     fallbackStream.getTracks().forEach(t => t.stop());
                     reader?.reset();
                     setTimeout(() => onScan(result.getText()), 400);
                   }
                 });
               }
             }
          } catch (fallbackErr) {
            setError("Erro ao iniciar a câmera (Fallback): " + (fallbackErr as Error).message);
          }
        } else {
          setError("Erro ao iniciar a câmera: " + (err.message || "Desconhecido"));
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (reader && videoRef.current) {
        reader.reset();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [onScan, scanState]);

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setZoomConfig(prev => ({ ...prev, current: val }));
    
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ zoom: val } as any]
          });
        } catch (err) {
          console.error("Erro ao aplicar zoom:", err);
        }
      }
    }
  };

  const isFound = scanState === "found";
  const frameColor = isFound ? "border-[#34B982]" : "border-white/50";

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col lg:hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10 absolute top-0 left-0 right-0">
        <div className="text-white font-semibold text-[17px]">Leitor de Código</div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="size-[42px] flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-95 transition-all"
            title="Diagnóstico do Detector"
          >
            <Info className="size-5" />
          </button>
          <button 
            onClick={onClose}
            className="size-[42px] flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-95 transition-all"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      {/* Main Camera Area */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {error ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-white gap-4 max-w-sm mx-auto">
            <AlertCircle className="size-12 text-red-500" />
            <p className="text-[15px] font-medium leading-relaxed">{error}</p>
            <Button onClick={onClose} variant="secondary" className="mt-4 px-8 h-12 rounded-xl font-semibold">Fechar</Button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 bg-black/40 backdrop-blur-[1px]" />
                <div className="flex shrink-0">
                  <div className="w-8 sm:w-16 bg-black/40 backdrop-blur-[1px]" />
                  <div className="relative w-full aspect-square max-w-[280px] max-h-[280px] sm:max-w-[320px] sm:max-h-[320px] mx-auto rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                    
                    {/* Corner Markers */}
                    <div className={`absolute -top-[2px] -left-[2px] size-8 border-t-[4px] border-l-[4px] ${frameColor} rounded-tl-xl transition-colors duration-200`} />
                    <div className={`absolute -top-[2px] -right-[2px] size-8 border-t-[4px] border-r-[4px] ${frameColor} rounded-tr-xl transition-colors duration-200`} />
                    <div className={`absolute -bottom-[2px] -left-[2px] size-8 border-b-[4px] border-l-[4px] ${frameColor} rounded-bl-xl transition-colors duration-200`} />
                    <div className={`absolute -bottom-[2px] -right-[2px] size-8 border-b-[4px] border-r-[4px] ${frameColor} rounded-br-xl transition-colors duration-200`} />
                    
                    {/* Fixed Red Scanning Line */}
                    {!isFound && (
                      <div className="absolute top-1/2 left-0 right-0 h-[1.5px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] -translate-y-1/2" />
                    )}
                    
                    {/* Success indicator inside frame */}
                    {isFound && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#34B982]/20 rounded-xl backdrop-blur-sm transition-all duration-300">
                        <CheckCircle2 className="size-16 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                  <div className="w-8 sm:w-16 bg-black/40 backdrop-blur-[1px]" />
                </div>
                <div className="flex-1 bg-black/40 backdrop-blur-[1px] flex flex-col items-center pt-8">
                  <p className="text-white font-semibold text-[16px] mb-1">
                    {isFound ? "Código reconhecido" : "Aponte para o código"}
                  </p>
                  <p className="text-white/70 text-[13px]">
                    {isFound ? "Buscando produto..." : "Código de barras ou QR Code"}
                  </p>
                </div>
              </div>
            </div>

            {/* Debug Panel */}
            {showDebug && debugInfo && (
              <div className="absolute top-20 left-4 z-50 bg-black/80 backdrop-blur-md text-green-400 font-mono text-[11px] p-3 rounded-lg border border-green-500/30 max-w-[80vw] overflow-auto pointer-events-auto shadow-xl">
                <h4 className="font-bold text-white mb-2 pb-1 border-b border-green-500/30">Diagnóstico do Detector</h4>
                <div className="flex flex-col gap-1">
                  <div><span className="text-white/50">Estado:</span> {scanState === 'found' ? 'OK' : 'ATIVO'}</div>
                  <div><span className="text-white/50">Detector:</span> <span className="text-yellow-300">{debugInfo.detector}</span></div>
                  {debugInfo.nativeFormats && <div><span className="text-white/50">Formatos Suportados (Nativo):</span> {debugInfo.nativeFormats}</div>}
                  {debugInfo.lastDetectedFormat && <div><span className="text-white/50">Formato Detectado:</span> <span className="font-bold text-white">{debugInfo.lastDetectedFormat}</span></div>}
                  {debugInfo.lastDetectedValue && <div><span className="text-white/50">Valor Detectado:</span> <span className="font-bold text-white">{debugInfo.lastDetectedValue}</span></div>}
                  <div className="border-t border-green-500/30 mt-2 pt-1"><span className="text-white/50">Câmera Real:</span> {debugInfo.actualWidth}x{debugInfo.actualHeight} @ {debugInfo.fps}fps</div>
                  <div><span className="text-white/50">Focus Mode:</span> {debugInfo.focusMode}</div>
                </div>
              </div>
            )}
            
            {/* Zoom Control */}
            {zoomCapable && !isFound && (
              <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center px-8 pointer-events-auto">
                <div className="w-full max-w-xs flex items-center gap-4 bg-black/50 backdrop-blur-md p-3 px-5 rounded-full border border-white/10 shadow-lg">
                  <ZoomOut className="size-5 text-white/80" />
                  <input 
                    type="range"
                    min={zoomConfig.min}
                    max={zoomConfig.max}
                    step={zoomConfig.step}
                    value={zoomConfig.current}
                    onChange={handleZoomChange}
                    className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <ZoomIn className="size-5 text-white/80" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
