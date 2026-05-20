import { ChevronDown, ChevronUp, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { generatePDFThumbnail } from '@/lib/pdfThumbnail';
import { toast } from 'sonner';

interface FileItemProps {
  file: File;
  index: number;
  totalFiles: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  draggedOverIndex?: number;
}

export function FileItem({
  file,
  index,
  totalFiles,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  draggedOverIndex,
}: FileItemProps) {
  const [thumbnail, setThumbnail] = useState<string>('');
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    generateThumbnail();
  }, [file]);

  const generateThumbnail = async () => {
    try {
      setIsLoadingThumbnail(true);
      setThumbnailError(false);
      
      if (file.type === 'application/pdf') {
        const thumb = await generatePDFThumbnail(file);
        setThumbnail(thumb);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setThumbnail(e.target?.result as string);
          setIsLoadingThumbnail(false);
        };
        reader.onerror = () => {
          setThumbnailError(true);
          setIsLoadingThumbnail(false);
          toast.error(`Failed to load thumbnail for ${file.name}`);
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      setThumbnailError(true);
      setIsLoadingThumbnail(false);
      toast.error(`Failed to generate thumbnail for ${file.name}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileTypeLabel = (): string => {
    if (file.type === 'application/pdf') return 'PDF';
    if (file.type === 'image/jpeg') return 'JPEG';
    if (file.type === 'image/png') return 'PNG';
    if (file.type === 'image/webp') return 'WebP';
    return 'File';
  };

  const isDraggedOver = draggedOverIndex === index;

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(index);
      }}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all duration-200 ${
        isDragging ? 'opacity-50' : ''
      } ${
        isDraggedOver ? 'border-accent bg-accent/5' : ''
      } hover:border-accent/30 hover:shadow-sm cursor-move`}
      role="listitem"
      aria-label={`File ${index + 1} of ${totalFiles}: ${file.name}`}
    >
      {/* Drag Handle */}
      <div 
        className="flex-shrink-0"
        role="button"
        tabIndex={0}
        aria-label={`Drag handle for ${file.name}`}
        onKeyDown={(e) => {
          // Allow keyboard users to interact with the item
          if (e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            onMoveUp();
          } else if (e.key === 'ArrowDown' && index < totalFiles - 1) {
            e.preventDefault();
            onMoveDown();
          }
        }}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        {isLoadingThumbnail ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/10 to-accent/5">
            <span className="text-xs font-semibold text-accent">Loading...</span>
          </div>
        ) : thumbnailError ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-destructive/10 to-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={`Thumbnail for ${file.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/10 to-accent/5">
            <span className="text-xs font-semibold text-accent">
              {getFileTypeLabel()}
            </span>
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {getFileTypeLabel()} • {formatFileSize(file.size)}
        </p>
      </div>

      {/* Index Badge */}
      <div className="flex-shrink-0">
        <span 
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
          aria-label={`Position ${index + 1}`}
        >
          {index + 1}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-shrink-0 items-center gap-1" role="group" aria-label="File actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={index === 0}
          className="h-8 w-8 p-0"
          aria-label={`Move ${file.name} up`}
          title="Move up (↑)"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={index === totalFiles - 1}
          className="h-8 w-8 p-0"
          aria-label={`Move ${file.name} down`}
          title="Move down (↓)"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${file.name}`}
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
