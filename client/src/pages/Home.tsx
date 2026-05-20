import { useState, useEffect } from 'react';
import { Loader2, Download, RotateCcw, RotateCw } from 'lucide-react';
import { FileItem } from '@/components/FileItem';
import { FileUpload } from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import MergedPDFEditor from '@/components/MergedPDFEditor';
import { mergePDFsAndImages } from '@/lib/pdfMerger';
import { useHistory } from '@/hooks/useHistory';
import { toast } from 'sonner';

export default function Home() {
  const { state: files, setState: setFiles, undo, redo, canUndo, canRedo } = useHistory<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [mergedPdf, setMergedPdf] = useState<Uint8Array | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleFilesSelected = (newFiles: File[]) => {
    const MAX_DOCUMENTS = 10;
    setFiles((prevFiles) => {
      const totalFiles = prevFiles.length + newFiles.length;
      
      if (totalFiles > MAX_DOCUMENTS) {
        const allowedCount = Math.max(0, MAX_DOCUMENTS - prevFiles.length);
        const filesToAdd = newFiles.slice(0, allowedCount);
        const rejectedCount = newFiles.length - filesToAdd.length;
        
        if (filesToAdd.length > 0) {
          toast.success(`${filesToAdd.length} arquivo(s) adicionado(s)`);
        }
        if (rejectedCount > 0) {
          toast.error('Permitido Mesclar 10 documentos por vez');
        }
        
        return [...prevFiles, ...filesToAdd];
      }
      
      toast.success(`${newFiles.length} arquivo(s) adicionado(s)`);
      return [...prevFiles, ...newFiles];
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newFiles = [...files];
    [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    setFiles(newFiles);
  };

  const handleMoveDown = (index: number) => {
    if (index === files.length - 1) return;
    const newFiles = [...files];
    [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    setFiles(newFiles);
  };

  const handleRemove = (index: number) => {
    const removedFile = files[index].name;
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
    toast.success(`${removedFile} removido`);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    setDraggedOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && draggedOverIndex !== null && draggedIndex !== draggedOverIndex) {
      const newFiles = [...files];
      const draggedFile = newFiles[draggedIndex];
      newFiles.splice(draggedIndex, 1);
      newFiles.splice(draggedOverIndex, 0, draggedFile);
      setFiles(newFiles);
      toast.success('Arquivo reordenado');
    }
    setDraggedIndex(null);
    setDraggedOverIndex(null);
  };

  const handleMergeAndDownload = async () => {
    if (files.length === 0) {
      toast.error('Por favor, adicione pelo menos um arquivo');
      return;
    }

    setIsMerging(true);
    try {
      const pdf = await mergePDFsAndImages(files);
      setMergedPdf(pdf);
      setShowEditor(true);
      toast.success('PDF mesclado! Agora você pode reordenar as páginas.');
    } catch (error) {
      console.error('Error merging PDFs:', error);
      toast.error(
        error instanceof Error ? error.message : 'Falha ao mesclar arquivos'
      );
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownloadFinalPdf = (pdfBytes: Uint8Array) => {
    const blob = new Blob([pdfBytes.buffer as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `merged-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setShowEditor(false);
    setMergedPdf(null);
    setFiles([]);
  };

  const handleUndo = () => {
    undo();
    toast.success('Ação desfeita');
  };

  const handleRedo = () => {
    redo();
    toast.success('Ação refeita');
  };



  useEffect(() => {
    const handleKeyDownWrapper = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDownWrapper);
    return () => window.removeEventListener('keydown', handleKeyDownWrapper);
  }, [handleUndo, handleRedo]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container py-8 sm:py-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-foreground sm:text-4xl">
                PDF & Image Merger
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Combine PDFs and images into a single PDF file. All processing happens on your device—nothing is uploaded to any server.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Upload Section */}
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <FileUpload onFilesSelected={handleFilesSelected} />
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Arquivos ({files.length})
            </h2>
            <p className="text-sm text-muted-foreground">
              Arraste para reordenar ou use os botões de seta
            </p>
              </div>

              <div
                className="space-y-2"
                role="list"
                aria-label="Files to merge"
              >
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <FileItem
                      file={file}
                      index={index}
                      totalFiles={files.length}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onRemove={() => handleRemove(index)}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      isDragging={draggedIndex === index}
                      draggedOverIndex={draggedOverIndex ?? undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {files.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-12 text-center animate-in fade-in duration-300">
              <p className="text-sm text-muted-foreground">
                Nenhum arquivo adicionado. Comece fazendo upload de um PDF ou imagem acima.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200"
                title="Desfazer (Ctrl+Z)"
                aria-label="Desfazer"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200"
                title="Refazer (Ctrl+Shift+Z ou Ctrl+Y)"
                aria-label="Refazer"
              >
                <RotateCw className="h-5 w-5" />
              </button>
            </div>

            {files.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiles([])}
                disabled={isMerging}
                className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpar Tudo
              </Button>
            )}

            <Button
              type="button"
              onClick={handleMergeAndDownload}
              disabled={files.length === 0 || isMerging}
              className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              size="lg"
              aria-busy={isMerging}
            >
              {isMerging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mesclando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Mesclar & Editar
                </>
              )}
            </Button>
          </div>

          {/* Info Section */}
          <div className="mt-12 rounded-lg bg-accent/5 p-6">
            <h3 className="mb-3 font-semibold text-foreground">Como funciona</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-semibold text-accent">1.</span>
                <span>Faça upload de arquivos PDF e imagens (JPG, PNG, WebP)</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent">2.</span>
                <span>Reordene os arquivos usando os botões de seta ou arrastando</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent">3.</span>
                <span>Clique em "Mesclar & Editar" para combinar em um único PDF</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent">4.</span>
                <span>Reordene as páginas conforme necessário</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent">5.</span>
                <span>Baixe seu PDF final pronto para usar</span>
              </li>
            </ul>
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Privacidade:</span> Todo
              o processamento de arquivos acontece inteiramente no seu navegador. Nenhum arquivo é
              enviado para um servidor, e seus dados nunca saem do seu dispositivo.
            </p>
          </div>
        </div>
      </div>

      {/* Merged PDF Editor Modal */}
      {showEditor && mergedPdf && (
        <MergedPDFEditor
          mergedPdfBytes={mergedPdf}
          onDownload={handleDownloadFinalPdf}
          onClose={() => {
            setShowEditor(false);
            setMergedPdf(null);
          }}
        />
      )}
    </div>
  );
}
