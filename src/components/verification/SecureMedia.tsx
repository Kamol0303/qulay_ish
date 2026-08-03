import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { resolveSecureMediaUrl } from '../../lib/secureMedia';

export function SecureImage({
  url,
  alt,
  className,
  onClick,
}: {
  url?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setLoading(true);
    void (async () => {
      const resolved = await resolveSecureMediaUrl(url);
      if (!active) return;
      if (resolved?.startsWith('blob:')) objectUrl = resolved;
      setSrc(resolved);
      setLoading(false);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className || ''}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className || ''}`}>
        <FileText className="h-6 w-6" />
      </div>
    );
  }

  const isPdf = (url || '').toLowerCase().includes('.pdf');
  if (isPdf) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={`flex flex-col items-center justify-center gap-2 bg-muted text-sm font-medium ${className || ''}`}
      >
        <FileText className="h-8 w-8" />
        PDF ochish
      </a>
    );
  }

  return (
    <img src={src} alt={alt} className={className} onClick={onClick} />
  );
}
