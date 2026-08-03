import { useRef, useState, type ReactNode } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { avatarFallback, mediaUrl } from '../../lib/mediaUrl';
import { cn } from '../../lib/utils';

export function AvatarUploader({
  name,
  photoUrl,
  onChange,
  editable = true,
}: {
  name: string;
  photoUrl?: string;
  onChange?: (url: string | undefined) => void;
  editable?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const src = mediaUrl(photoUrl) || avatarFallback(name);

  const handleFile = async (file?: File | null) => {
    if (!file || !onChange) return;
    setLoading(true);
    try {
      const res = await api.uploads.upload(file, 'photo');
      onChange(res.url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-28 w-28 shrink-0 md:h-32 md:w-32">
      <img
        src={src}
        alt={name}
        className="h-full w-full rounded-2xl border-4 border-background object-cover shadow-lg"
      />
      {editable && (
        <>
          <button
            type="button"
            aria-label="Profil rasmini yuklash"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </>
      )}
    </div>
  );
}

export function CoverUploader({
  coverUrl,
  onChange,
  editable = true,
  children,
  className,
}: {
  coverUrl?: string;
  onChange?: (url: string | undefined) => void;
  editable?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const src = mediaUrl(coverUrl);

  const handleFile = async (file?: File | null) => {
    if (!file || !onChange) return;
    setLoading(true);
    try {
      const res = await api.uploads.upload(file, 'cover');
      onChange(res.url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'relative h-40 overflow-hidden rounded-2xl md:h-52',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-cyan-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
      {editable && (
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/60"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Cover
          </button>
          {coverUrl && (
            <button
              type="button"
              aria-label="Cover o'chirish"
              onClick={() => onChange?.(undefined)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      )}
      <div className="relative z-10 flex h-full items-end p-4 md:p-6">{children}</div>
    </div>
  );
}

export function FileUploadButton({
  label,
  accept,
  kind,
  onUploaded,
}: {
  label: string;
  accept: string;
  kind: 'certificate' | 'portfolio' | 'document' | 'file';
  onUploaded: (file: {
    url: string;
    fileName: string;
    mimeType: string;
  }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          try {
            const res = await api.uploads.upload(file, kind);
            onUploaded({
              url: res.url,
              fileName: res.originalName || res.filename,
              mimeType: res.mimeType,
            });
          } finally {
            setLoading(false);
            e.target.value = '';
          }
        }}
      />
    </>
  );
}
