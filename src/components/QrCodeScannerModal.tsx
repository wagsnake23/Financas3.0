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
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { QrReader } from "react-qr-reader";
import { toast } from "sonner";

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
    if (isScanning) { // Only show error if actively scanning
      toast.error("Erro ao acessar a câmera ou escanear QR Code.", { duration: toastDuration, style: toastErrorStyle });
      setIsScanning(false); // Stop scanning on error
    }
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