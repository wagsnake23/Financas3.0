"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { QrReader } from "react-qr-reader";
import { toast } from "sonner";
// Importe jsQR se estiver usando: import jsQR from "jsqr";

interface ProductItem {
  description: string;
  quantity: number;
  unitValue: number;
  total: number;
}

interface ScannedNfceData {
  totalAmount: number;
  paymentMethod: string;
  items: ProductItem[];
}

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImportData: (data: ScannedNfceData) => void;
}

const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

// --- PLACEHOLDERS PARA A API DA NUVEM FISCAL ---
// Você precisará substituir estes valores pelos reais da sua integração.
// Recomenda-se usar variáveis de ambiente para a chave da API (ex: import.meta.env.VITE_NUVEM_FISCAL_API_KEY)
const NUVEM_FISCAL_API_URL = "https://api.nuvemfiscal.com.br/v1/nfce/scan"; // Exemplo de URL
const NUVEM_FISCAL_API_KEY = "YOUR_NUVEM_FISCAL_API_KEY"; // Substitua pela sua chave real da API

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onOpenChange,
  onImportData,
}) => {
  const isMobile = useIsMobile();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedNfceData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingApi, setLoadingApi] = useState(false);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setScannedData(null);
      setIsScanning(true);
      setLoadingApi(false);
    } else {
      setIsScanning(false);
    }
  }, [isOpen]);

  const handleScan = async (result: string | null) => {
    if (result && !scanResult) {
      setScanResult(result);
      setIsScanning(false);
      setLoadingApi(true);
      toast.info("QR Code escaneado! Processando dados da nota fiscal...", { duration: toastDuration });

      try {
        const response = await fetch(NUVEM_FISCAL_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${NUVEM_FISCAL_API_KEY}`, // Ou o método de autenticação da Nuvem Fiscal
          },
          body: JSON.stringify({ qrCodeUrl: result }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Erro na API da Nuvem Fiscal: ${response.status}`);
        }

        const apiData = await response.json();

        // --- PARSE A RESPOSTA DA API AQUI ---
        // Você precisará adaptar esta lógica para a estrutura exata da resposta da Nuvem Fiscal.
        const parsedData: ScannedNfceData = {
          totalAmount: apiData.totalAmount, // Exemplo: apiData.valorTotal
          paymentMethod: apiData.paymentMethod, // Exemplo: apiData.formaPagamento
          items: apiData.items.map((item: any) => ({ // Exemplo: apiData.produtos
            description: item.description, // Exemplo: item.nomeProduto
            quantity: item.quantity,     // Exemplo: item.quantidade
            unitValue: item.unitValue,   // Exemplo: item.valorUnitario
            total: item.total,           // Exemplo: item.valorTotalItem
          })),
        };
        // --- FIM DO PARSE ---

        setScannedData(parsedData);
        toast.success("Dados da nota fiscal carregados!", { duration: toastDuration, style: toastSuccessStyle });

      } catch (error: any) {
        console.error("Erro ao processar QR Code com a Nuvem Fiscal:", error);
        toast.error("Erro ao carregar dados da nota fiscal.", { description: error.message, duration: toastDuration, style: toastErrorStyle });
        setScannedData(null); // Limpa dados em caso de erro
      } finally {
        setLoadingApi(false);
      }
    }
  };

  const handleError = (err: any) => {
    console.error("QR Code Scanner Error:", err);
    if (isScanning) {
      toast.error("Erro ao acessar a câmera ou escanear QR Code.", { duration: toastDuration, style: toastErrorStyle });
      setIsScanning(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) fileInputRef.current.value = ''; // Limpa o input se nenhum arquivo for selecionado
      return;
    }

    setLoadingApi(true);
    toast.info("Processando imagem do QR Code...", { duration: toastDuration });

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error("handleImageUpload: Canvas ref is null.");
          toast.error("Erro interno: Canvas não disponível.", { duration: toastDuration, style: toastErrorStyle });
          setLoadingApi(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error("handleImageUpload: Canvas context is null.");
          toast.error("Erro interno: Contexto do canvas não disponível.", { duration: toastDuration, style: toastErrorStyle });
          setLoadingApi(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Verifica se a imagem carregou com dimensões válidas
        if (img.width === 0 || img.height === 0) {
          console.error("handleImageUpload: Imagem inválida ou não carregada corretamente (dimensões zero).");
          toast.error("Erro: Imagem inválida ou não carregada corretamente.", { duration: toastDuration, style: toastErrorStyle });
          setLoadingApi(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          console.log("handleImageUpload: Imagem desenhada no canvas com sucesso.");

          // --- AQUI VOCÊ USARIA UMA BIBLIOTECA COMO jsQR ---
          // Exemplo de uso com jsQR (certifique-se de importá-lo e instalá-lo: npm install jsqr):
          // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          // const code = jsQR(imageData.data, imageData.width, imageData.height, {
          //   inversionAttempts: "dontInvert",
          // });

          // if (code) {
          //   handleScan(code.data);
          // } else {
          //   toast.error("Nenhum QR Code encontrado na imagem.", { duration: toastDuration, style: toastErrorStyle });
          //   setLoadingApi(false);
          // }
          // --- FIM DO EXEMPLO jsQR ---

          // Placeholder para simular o resultado de um QR Code da galeria
          // REMOVA ESTE BLOCO E DESCOMENTE O CÓDIGO jsQR ACIMA QUANDO TIVER A BIBLIOTECA
          const simulatedQrCodeData = "https://www.fazenda.pr.gov.br/nfce/qrcode?p=41230176483817000100650010000000011000000001|2|1|1|1234567890";
          handleScan(simulatedQrCodeData);
          // FIM DO PLACEHOLDER

        } catch (drawOrDecodeError: any) {
          console.error("handleImageUpload: Erro ao desenhar ou decodificar QR Code da imagem:", drawOrDecodeError);
          toast.error("Erro ao processar imagem do QR Code.", { description: drawOrDecodeError.message, duration: toastDuration, style: toastErrorStyle });
          setLoadingApi(false);
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = ''; // Limpa o input de arquivo
        }
      };
      img.onerror = () => {
        console.error("handleImageUpload: Erro ao carregar a imagem.");
        toast.error("Erro ao carregar a imagem selecionada.", { duration: toastDuration, style: toastErrorStyle });
        setLoadingApi(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (error) => {
      console.error("handleImageUpload: Erro ao ler o arquivo:", error);
      toast.error("Erro ao ler o arquivo de imagem.", { duration: toastDuration, style: toastErrorStyle });
      setLoadingApi(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleImport = () => {
    if (scannedData) {
      onImportData(scannedData);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("w-full", isMobile ? "max-w-[98vw] p-4 min-h-[80vh]" : "sm:max-w-[600px] max-h-[90vh] overflow-y-auto")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DynamicIcon name="🧾" className="h-6 w-6" />
            Dados da Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            {isScanning && "Escaneando QR Code..."}
            {loadingApi && "Processando dados da nota fiscal..."}
            {!isScanning && !loadingApi && !scannedData && "Aguardando QR Code..."}
            {!isScanning && !loadingApi && scannedData && "Dados da nota fiscal carregados."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isScanning && (
            <div ref={qrReaderRef} className={cn("w-full bg-gray-100 rounded-lg overflow-hidden", isMobile ? "h-60" : "h-80")}>
              <QrReader
                onResult={(result, error) => {
                  if (!!result) {
                    handleScan(result?.getText());
                  }

                  if (!!error) {
                    handleError(error);
                  }
                }}
                constraints={{ facingMode: "environment" }} // Use rear camera
                scanDelay={500}
                videoContainerStyle={{ padding: '0' }}
                videoStyle={{ objectFit: 'cover' }}
              />
            </div>
          )}

          {!isScanning && !loadingApi && !scannedData && (
            <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-gray-50 text-center">
              <p className="text-muted-foreground mb-4">Ou</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl"
                variant="outline"
                disabled={loadingApi} // Desabilita o botão enquanto a API está carregando
              >
                <DynamicIcon name="🖼️" className="mr-2 h-4 w-4" />
                Buscar na Galeria
              </Button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              <canvas ref={canvasRef} className="hidden"></canvas> {/* Canvas oculto para decodificação */}
            </div>
          )}

          {scannedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Valor Total da Nota</Label>
                  <p className="text-lg font-bold">{scannedData.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Forma de Pagamento</Label>
                  <p className="text-lg font-bold capitalize">{scannedData.paymentMethod}</p>
                </div>
              </div>

              <h3 className="text-md font-semibold mt-4">Itens da Nota:</h3>
              <div className={cn("border rounded-lg overflow-hidden", isMobile ? "max-h-40" : "max-h-60")}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scannedData.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum item encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      scannedData.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">{item.unitValue.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">{item.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!scannedData || loadingApi} className="rounded-xl">
            Importar para formulário
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};