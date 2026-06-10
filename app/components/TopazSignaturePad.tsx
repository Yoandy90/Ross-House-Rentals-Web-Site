'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Tablet, AlertCircle, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// Declare global Topaz SigWeb functions
declare global {
  interface Window {
    IsSigWebInstalled: () => boolean;
    SetTabletState: (state: number, ctx?: CanvasRenderingContext2D | null, delay?: number) => any;
    SetJustifyMode: (mode: number) => void;
    SetSigCompressionMode: (mode: number) => void;
    SetImageXSize: (size: number) => void;
    SetImageYSize: (size: number) => void;
    SetImagePenWidth: (width: number) => void;
    SetDisplayXSize: (size: number) => void;
    SetDisplayYSize: (size: number) => void;
    GetSigImageB64: (callback: (sig: string) => void) => void;
    GetSigString: () => string;
    ClearTablet: () => void;
    NumberOfTabletPoints: () => number;
    SetLCDCaptureMode: (mode: number) => void;
    LCDRefresh: (mode: number, x1: number, y1: number, x2: number, y2: number) => void;
    LCDWriteString: (mode: number, font: number, x: number, y: number, text: string) => void;
    KeyPadClearHotSpotList: () => void;
    LCDSetWindow: (x1: number, y1: number, x2: number, y2: number) => void;
    tmr?: any;
  }
}

interface TopazSignaturePadProps {
  onSignatureCapture: (signatureBase64: string) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
  signerName?: string;
}

export default function TopazSignaturePad({
  onSignatureCapture,
  onError,
  width = 500,
  height = 150,
  signerName = 'Firmante',
}: TopazSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSigWebInstalled, setIsSigWebInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const timerRef = useRef<any>(null);

  // Load SigWeb script
  useEffect(() => {
    const loadScript = () => {
      // Check if already loaded
      if (typeof window !== 'undefined' && typeof window.IsSigWebInstalled === 'function') {
        setIsLoading(false);
        checkSigWebInstalled();
        return;
      }

      const script = document.createElement('script');
      script.src = '/SigWebTablet.js';
      script.async = true;
      
      script.onload = () => {
        console.log('SigWebTablet.js loaded');
        setIsLoading(false);
        // Small delay to ensure all functions are available
        setTimeout(checkSigWebInstalled, 500);
      };
      
      script.onerror = (e) => {
        console.error('Failed to load SigWebTablet.js', e);
        setIsLoading(false);
        setError('No se pudo cargar el SDK de Topaz');
        if (onError) onError('Failed to load Topaz SDK');
      };

      document.head.appendChild(script);
    };

    loadScript();

    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (typeof window !== 'undefined' && window.SetTabletState) {
        try {
          window.SetTabletState(0);
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  const checkSigWebInstalled = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      if (typeof window.IsSigWebInstalled === 'function') {
        const installed = window.IsSigWebInstalled();
        console.log('SigWeb installed:', installed);
        setIsSigWebInstalled(installed);
        
        if (!installed) {
          setError('SigWeb no está instalado o no está ejecutándose. Verifique que el servicio SigWeb esté activo.');
        } else {
          setError(null);
        }
      } else {
        console.error('IsSigWebInstalled function not found');
        setIsSigWebInstalled(false);
        setError('SDK de Topaz no cargó correctamente');
      }
    } catch (e) {
      console.error('Error checking SigWeb:', e);
      setIsSigWebInstalled(false);
      setError('Error al verificar SigWeb');
    }
  }, []);

  const connectToTablet = useCallback(() => {
    if (!isSigWebInstalled) {
      setError('SigWeb no está disponible');
      return;
    }

    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        setError('Canvas no disponible');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('No se pudo obtener contexto del canvas');
        return;
      }

      // Clear canvas
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Configure tablet - using the actual SDK functions
      if (window.SetDisplayXSize) window.SetDisplayXSize(canvas.width);
      if (window.SetDisplayYSize) window.SetDisplayYSize(canvas.height);
      if (window.SetImageXSize) window.SetImageXSize(canvas.width);
      if (window.SetImageYSize) window.SetImageYSize(canvas.height);
      if (window.SetJustifyMode) window.SetJustifyMode(0);
      if (window.SetSigCompressionMode) window.SetSigCompressionMode(1);

      // For LCD pads - clear and show message
      try {
        if (window.KeyPadClearHotSpotList) window.KeyPadClearHotSpotList();
        if (window.LCDRefresh) window.LCDRefresh(0, 0, 0, 240, 64);
        if (window.LCDWriteString) {
          window.LCDWriteString(0, 2, 10, 5, 'Firme Aqui');
          window.LCDWriteString(0, 1, 10, 30, signerName.substring(0, 25));
        }
        if (window.LCDSetWindow) window.LCDSetWindow(0, 0, 1, 1);
        if (window.SetLCDCaptureMode) window.SetLCDCaptureMode(2);
      } catch (lcdError) {
        console.log('LCD functions not available (OK for non-LCD pads)');
      }

      // Start capture - SetTabletState(1, ctx, refreshRate)
      const timer = window.SetTabletState(1, ctx, 50);
      timerRef.current = timer;

      setIsConnected(true);
      setError(null);
      setHasSignature(false);

      // Poll for signature points
      const pointChecker = setInterval(() => {
        try {
          const points = window.NumberOfTabletPoints ? window.NumberOfTabletPoints() : 0;
          if (points > 0) {
            setHasSignature(true);
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 300);

      // Store the point checker to clean up later
      timerRef.current = { sigTimer: timer, pointChecker };

    } catch (e: any) {
      console.error('Error connecting to tablet:', e);
      setError(`Error al conectar: ${e.message || 'Desconocido'}`);
      setIsConnected(false);
    }
  }, [isSigWebInstalled, signerName]);

  const disconnectTablet = useCallback(() => {
    try {
      // Clear timers
      if (timerRef.current) {
        if (timerRef.current.pointChecker) {
          clearInterval(timerRef.current.pointChecker);
        }
        if (timerRef.current.sigTimer) {
          clearInterval(timerRef.current.sigTimer);
        }
        timerRef.current = null;
      }
      
      // Stop tablet capture
      if (window.SetTabletState) {
        window.SetTabletState(0);
      }
      
      setIsConnected(false);
    } catch (e) {
      console.error('Error disconnecting:', e);
    }
  }, []);

  const clearSignature = useCallback(() => {
    try {
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      // Clear tablet
      if (window.ClearTablet) {
        window.ClearTablet();
      }

      setHasSignature(false);
    } catch (e) {
      console.error('Error clearing:', e);
    }
  }, []);

  const captureSignature = useCallback(() => {
    if (!hasSignature) {
      setError('No hay firma. El cliente debe firmar en el pad.');
      return;
    }

    try {
      // Get signature as Base64 image
      if (window.GetSigImageB64) {
        window.GetSigImageB64((sigImageB64: string) => {
          if (sigImageB64 && sigImageB64.length > 0) {
            const fullBase64 = `data:image/png;base64,${sigImageB64}`;
            onSignatureCapture(fullBase64);
            disconnectTablet();
          } else {
            setError('No se pudo obtener la imagen de la firma');
          }
        });
      } else {
        setError('Función GetSigImageB64 no disponible');
      }
    } catch (e: any) {
      console.error('Error capturing:', e);
      setError(`Error al capturar: ${e.message || 'Desconocido'}`);
    }
  }, [hasSignature, onSignatureCapture, disconnectTablet]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-2" />
        <p className="text-purple-300 text-sm">Cargando SDK de Topaz...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSigWebInstalled ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 font-medium">SigWeb Detectado</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">SigWeb No Detectado</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Wifi className="w-3 h-3" /> Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
              <WifiOff className="w-3 h-3" /> Desconectado
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`w-full bg-white rounded-xl border-2 ${
            isConnected ? 'border-emerald-500' : 'border-dashed border-purple-500/50'
          }`}
          style={{ touchAction: 'none' }}
        />
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
            <div className="text-center">
              <Tablet className="w-10 h-10 text-purple-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Haga clic en "Conectar Pad"</p>
            </div>
          </div>
        )}
        {isConnected && hasSignature && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full">
            ✓ Firma Detectada
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• SigWeb debe estar instalado y ejecutándose</p>
        <p>• El pad Topaz debe estar conectado por USB</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={connectToTablet}
            disabled={!isSigWebInstalled}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Tablet className="w-4 h-4" />
            Conectar Pad
          </button>
        ) : (
          <>
            <button
              onClick={clearSignature}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-700/50 text-gray-300 rounded-xl hover:bg-gray-700 text-sm transition"
            >
              <RefreshCw className="w-4 h-4" />
              Limpiar
            </button>
            <button
              onClick={captureSignature}
              disabled={!hasSignature}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              Capturar
            </button>
          </>
        )}
      </div>

      {isConnected && (
        <button
          onClick={disconnectTablet}
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-400 transition"
        >
          Desconectar
        </button>
      )}
    </div>
  );
}
