import React from 'react';
import { AlertCircle, Send, Loader2 } from 'lucide-react';

type ChatComposerProps = {
  disabled?: boolean;
  blocked?: boolean;
  moderationError?: string | null;
  placeholder: string;
  onSend: (text: string) => Promise<void>;
  onFocusChange?: (focused: boolean) => void;
};

/**
 * Uncontrolled composer — keystrokes never call setState, so parent trees
 * cannot remount/flicker while the user types.
 */
const ChatComposer = React.memo(function ChatComposer({
  disabled,
  blocked,
  moderationError,
  placeholder,
  onSend,
  onFocusChange,
}: ChatComposerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [sending, setSending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim() ?? '';
    if (!value || sending || disabled || blocked) return;
    setSending(true);
    try {
      await onSend(value);
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card p-4">
      {moderationError && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} />
          <span>{moderationError}</span>
        </div>
      )}
      {blocked && (
        <div className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center text-sm font-bold text-yellow-700">
          Siz vaqtincha bloklangansiz.
        </div>
      )}
      <div className="flex items-center space-x-3 rounded-2xl border border-border bg-secondary/40 p-2 focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50">
        <input
          ref={inputRef}
          type="text"
          name="chat-message"
          defaultValue=""
          placeholder={placeholder}
          disabled={Boolean(blocked || disabled || sending)}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          className="flex-1 border-none bg-transparent px-3 py-2 text-sm outline-none focus:ring-0 disabled:opacity-50"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={Boolean(blocked || disabled || sending)}
          className="rounded-xl bg-blue-500 p-3 text-white shadow-lg transition-colors hover:bg-blue-600 disabled:opacity-50 disabled:shadow-none"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </form>
  );
});

export default ChatComposer;
