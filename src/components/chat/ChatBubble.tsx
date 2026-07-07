import { useState } from 'react';
import { X } from 'lucide-react';
import { LegalChatBot } from './LegalChatBot';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { PremiumChatGlyph } from '@/components/icons/PremiumIcon';

export function ChatBubble() {
  const { t } = useTranslation('ai');
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  const handleOpen = () => {
    setIsOpen(true);
    setShowTooltip(false);
  };

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2 pb-safe">
          {showTooltip && (
            <div className="relative flex items-center">
              <div className="bg-card border shadow-lg rounded-2xl rounded-br-sm px-4 py-2 text-sm font-medium text-foreground max-w-[200px] text-right animate-in fade-in slide-in-from-bottom-2 duration-500">
                {t('chat_bubble_hint')}
              </div>
              <button
                className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }}
                aria-label="Close hint"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
          )}

          <button
            onClick={handleOpen}
            className={cn(
              "group relative h-14 w-14 overflow-hidden rounded-full text-[hsl(38,76%,72%)]",
              "border border-[rgba(215,180,106,0.28)] bg-[radial-gradient(circle_at_30%_18%,rgba(255,231,177,0.22),transparent_34%),linear-gradient(145deg,#17233d,#071126_72%)]",
              "flex items-center justify-center transition-all duration-300",
              "shadow-[0_10px_28px_rgba(0,0,0,0.34),0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.1)]",
              "hover:scale-110 hover:shadow-[0_14px_34px_rgba(0,0,0,0.42),0_0_24px_rgba(215,180,106,0.18)]",
              "animate-in zoom-in duration-300"
            )}
            aria-label={t('ai_name', 'AI Legal Chat')}
          >
            <PremiumChatGlyph size={27} className="relative z-10 drop-shadow-[0_2px_8px_rgba(215,180,106,0.28)] transition-transform group-hover:scale-110" />
            <span className="absolute inset-0 rounded-full bg-[rgba(215,180,106,0.16)] animate-ping opacity-45" />
          </button>
        </div>
      )}

      <LegalChatBot
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
