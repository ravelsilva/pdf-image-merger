import { Upload, AlertCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  const validateFiles = (filesToValidate: File[]): { valid: File[]; invalid: File[] } => {
    const valid: File[] = [];
    const invalid: File[] = [];

    filesToValidate.forEach((file) => {
      const isValidType = Object.keys(ACCEPTED_TYPES).includes(file.type);
      if (isValidType) {
        valid.push(file);
      } else {
        invalid.push(file);
      }
    });

    return { valid, invalid };
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setError(null);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    const { valid, invalid } = validateFiles(files);

    if (invalid.length > 0) {
      const invalidNames = invalid.map((f) => f.name).join(', ');
      const errorMsg = `Unsupported file type(s): ${invalidNames}. Supported formats: PDF, JPEG, PNG, WebP`;
      setError(errorMsg);
      toast.error(errorMsg);
    }

    if (valid.length > 0) {
      onFilesSelected(valid);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);

    const { valid, invalid } = validateFiles(files);

    if (invalid.length > 0) {
      const invalidNames = invalid.map((f) => f.name).join(', ');
      const errorMsg = `Unsupported file type(s): ${invalidNames}. Supported formats: PDF, JPEG, PNG, WebP`;
      setError(errorMsg);
      toast.error(errorMsg);
    }

    if (valid.length > 0) {
      onFilesSelected(valid);
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-lg border-2 border-dashed transition-all duration-200 ${
        isDragging
          ? 'border-accent bg-accent/5'
          : error
            ? 'border-destructive bg-destructive/5'
            : 'border-border bg-card hover:border-accent/50'
      }`}
      role="region"
      aria-label="File upload area"
    >
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        <div
          className={`mb-4 rounded-full p-3 transition-colors ${
            error
              ? 'bg-destructive/10'
              : 'bg-accent/10'
          }`}
        >
          {error ? (
            <AlertCircle className="h-6 w-6 text-destructive" strokeWidth={1.5} />
          ) : (
            <Upload className="h-6 w-6 text-accent" strokeWidth={1.5} />
          )}
        </div>

        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {error ? 'Upload Error' : 'Drop files here or click to browse'}
        </h3>

        <p className={`mb-6 text-center text-sm ${
          error ? 'text-destructive' : 'text-muted-foreground'
        }`}>
          {error || 'Supported formats: PDF, JPEG, PNG, WebP'}
        </p>

        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="font-medium"
          variant={error ? 'outline' : 'default'}
        >
          Select Files
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="Upload files"
        />
      </div>
    </div>
  );
}
