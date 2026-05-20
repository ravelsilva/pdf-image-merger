import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, GripVertical, Download, RotateCcw, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { useHistory } from '@/hooks/useHistory';
import {
  generatePageThumbnail,
  getPageCount,
  createMergedPDFWithEdits,
  type MergedPage,
} from '@/lib/pdfPageEditor';

interface MergedPDFEditorProps {
  mergedPdfBytes: Uint8Array;
  onDownload: (pdfBytes: Uint8Array) => void;
  onClose: () => void;
}

export default function MergedPDFEditor({
  mergedPdfBytes,
  onDownload,
  onClose,
}: MergedPDFEditorProps) {
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<'single' | 'multiple'>('single');

  const { state: pages, setState: setPages, undo, redo, canUndo, canRedo } = useHistory<MergedPage[]>([]);

  // Initialize pages from merged PDF
  useEffect(() => {
    const initializePages = async () => {
      try {
        const pageCount = await getPageCount(mergedPdfBytes);
        const newPages: MergedPage[] = [];

        for (let i = 0; i < pageCount; i++) {
          const thumbnail = await generatePageThumbnail(mergedPdfBytes, i);
          newPages.push({
            id: `page-${i}`,
            pageIndex: i,
            rotation: 0,
            thumbnail,
          });
          
          const progress = Math.round(((i + 1) / pageCount) * 100);
          setLoadingProgress(progress);
        }

        setPages(newPages);
        if (newPages.length > 0) {
          setSelectedIds(new Set([newPages[0].id]));
        }
      } catch (error) {
        console.error('Error initializing pages:', error);
        toast.error('Erro ao carregar páginas do PDF');
      } finally {
        setLoading(false);
      }
    };

    initializePages();
  }, [mergedPdfBytes, setPages]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        toast.success('Ação desfeita');
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        toast.success('Ação refeita');
      }

      // Delete key to remove selected pages
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        if (selectedIds.size === 1) {
          setPageToDelete(Array.from(selectedIds)[0]);
          setDeleteMode('single');
        } else {
          setDeleteMode('multiple');
        }
        setShowDeleteConfirm(true);
      }

      // Arrow keys to reorder (only if single selection)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedIds.size === 1) {
        e.preventDefault();
        const selectedId = Array.from(selectedIds)[0];
        const currentIndex = pages.findIndex((p) => p.id === selectedId);
        if (currentIndex === -1) return;

        let newIndex = currentIndex;
        if (e.key === 'ArrowUp' && currentIndex > 0) {
          newIndex = currentIndex - 1;
        } else if (e.key === 'ArrowDown' && currentIndex < pages.length - 1) {
          newIndex = currentIndex + 1;
        }

        if (newIndex !== currentIndex) {
          const newPages = [...pages];
          const [movedPage] = newPages.splice(currentIndex, 1);
          newPages.splice(newIndex, 0, movedPage);
          setPages(newPages);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, pages, setPages, undo, redo]);

  const handlePageClick = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + Click: toggle selection
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } else if (e.shiftKey) {
      // Shift + Click: range selection
      const clickedIndex = pages.findIndex((p) => p.id === id);
      const firstSelectedId = Array.from(selectedIds)[0];
      const firstSelectedIndex = firstSelectedId ? pages.findIndex((p) => p.id === firstSelectedId) : 0;

      const start = Math.min(clickedIndex, firstSelectedIndex);
      const end = Math.max(clickedIndex, firstSelectedIndex);

      const newSet = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSet.add(pages[i].id);
      }
      setSelectedIds(newSet);
    } else {
      // Regular click: single selection
      setSelectedIds(new Set([id]));
    }
  };

  const handleDeleteClick = (id: string) => {
    setPageToDelete(id);
    setDeleteMode('single');
    setShowDeleteConfirm(true);
  };

  const handleDeleteSelectedClick = () => {
    setDeleteMode('multiple');
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (deleteMode === 'single' && pageToDelete) {
      const newPages = pages.filter((page) => page.id !== pageToDelete);
      setPages(newPages);

      // Update selection
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(pageToDelete);
        if (newSet.size === 0 && newPages.length > 0) {
          newSet.add(newPages[0].id);
        }
        return newSet;
      });

      toast.success('Página removida');
    } else if (deleteMode === 'multiple') {
      const newPages = pages.filter((page) => !selectedIds.has(page.id));
      setPages(newPages);
      setSelectedIds(new Set());
      if (newPages.length > 0) {
        setSelectedIds(new Set([newPages[0].id]));
      }
      toast.success(`${selectedIds.size} página(s) removida(s)`);
    }
    setShowDeleteConfirm(false);
    setPageToDelete(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    // If dragging a non-selected page, select only that page
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set([id]));
      setDraggedIds(new Set([id]));
    } else {
      // Dragging a selected page, use all selected pages
      setDraggedIds(new Set(selectedIds));
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedIds.size === 0 || draggedIds.has(targetId)) return;

    const draggedArray = Array.from(draggedIds);
    const targetIndex = pages.findIndex((p) => p.id === targetId);

    const newPages = [...pages];

    // Remove dragged pages in reverse order to maintain indices
    const draggedPagesData = draggedArray
      .map((id) => {
        const index = newPages.findIndex((p) => p.id === id);
        return { index, page: newPages[index] };
      })
      .sort((a, b) => b.index - a.index);

    draggedPagesData.forEach(({ index }) => {
      newPages.splice(index, 1);
    });

    // Insert at target position
    const insertIndex = Math.min(targetIndex, newPages.length);
    draggedPagesData.reverse().forEach(({ page }) => {
      newPages.splice(insertIndex, 0, page);
    });

    setPages(newPages);
    setDraggedIds(new Set());
  };

  const handleSaveAndDownload = async () => {
    try {
      setSaving(true);
      const finalPdf = await createMergedPDFWithEdits(mergedPdfBytes, pages);
      onDownload(finalPdf);
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Erro ao processar PDF');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white p-8">
          <div className="flex flex-col items-center gap-6">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Carregando páginas...</h3>
              <p className="text-sm text-gray-600 mb-4">{loadingProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white">
        {/* Header */}
        <div className="border-b p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                Editar PDF Mesclado
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {pages.length} de {pages.length} página{pages.length !== 1 ? 's' : ''}
                {selectedIds.size > 0 && ` • ${selectedIds.size} selecionada${selectedIds.size !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Desfazer (Ctrl+Z)"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refazer (Ctrl+Shift+Z)"
              >
                <RotateCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Pages Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {pages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Nenhuma página disponível
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map((page) => (
                <div
                  key={page.id}
                  draggable
                  onClick={(e) => handlePageClick(page.id, e)}
                  onDragStart={(e) => handleDragStart(e, page.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, page.id)}
                  className={`group relative border-2 rounded-lg overflow-hidden transition-all cursor-move ${
                    draggedIds.has(page.id)
                      ? 'opacity-50 border-blue-500'
                      : selectedIds.has(page.id)
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative bg-gray-100 aspect-[8.5/11]">
                    <img
                      src={page.thumbnail}
                      alt={`Página ${page.pageIndex + 1}`}
                      className="w-full h-full object-contain"
                    />

                    {/* Drag Handle */}
                    <div className="absolute top-2 left-2 bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-gray-600" />
                    </div>

                    {/* Page Number */}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Pág {page.pageIndex + 1}
                    </div>

                    {/* Selection Indicator */}
                    {selectedIds.has(page.id) && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-2 bg-gray-50 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(page.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
                      title="Remover página (Delete)"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Remover</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 sm:p-6 flex flex-col gap-3 sm:flex-row sm:justify-between bg-gray-50">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            {selectedIds.size > 1 && (
              <Button
                variant="outline"
                onClick={handleDeleteSelectedClick}
                disabled={saving}
                className="text-red-700 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover Selecionadas ({selectedIds.size})
              </Button>
            )}
          </div>
          <Button
            onClick={handleSaveAndDownload}
            disabled={saving || pages.length === 0}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Baixar PDF
              </>
            )}
          </Button>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteMode === 'single' ? 'Remover página?' : `Remover ${selectedIds.size} páginas?`}
              </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'single'
                ? 'Tem certeza que deseja remover esta página? Esta ação poderá ser desfeita utilizando o botão Desfazer.'
                : `Tem certeza que deseja remover ${selectedIds.size} páginas? Esta ação poderá ser desfeita utilizando o botão Desfazer.`}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
