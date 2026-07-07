import { useState } from 'react';
import { X } from 'lucide-react';
import { NotesPanel } from './NotesPanel';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { PremiumDocumentGlyph } from '@/components/icons/PremiumIcon';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';

export function NotesBubble() {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-4 right-[4.5rem] sm:bottom-6 sm:right-24 z-50 flex flex-col items-end gap-2 pb-safe">
          {showTooltip && (
            <div className="relative flex items-center">
              <div className="bg-card border shadow-lg rounded-2xl rounded-br-sm px-4 py-2 text-sm font-medium text-foreground max-w-[200px] text-right animate-in fade-in slide-in-from-bottom-2 duration-500">
                {t('my_notes', '\u041c\u043e\u0438 \u0437\u0430\u043f\u0438\u0441\u0438')}
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
            onClick={() => setIsOpen(true)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={cn(
              "group relative h-14 w-14 overflow-hidden rounded-full text-[hsl(38,74%,76%)]",
              "border border-white/10 bg-[radial-gradient(circle_at_34%_18%,rgba(255,255,255,0.11),transparent_34%),linear-gradient(145deg,#1c2437,#101725_70%)]",
              "flex items-center justify-center transition-all duration-300",
              "shadow-[0_10px_28px_rgba(0,0,0,0.32),0_0_0_1px_rgba(255,255,255,0.05),inset_0_1px_0_rgba(255,255,255,0.1)]",
              "hover:scale-110 hover:shadow-[0_14px_34px_rgba(0,0,0,0.42),0_0_22px_rgba(215,180,106,0.16)]",
              "animate-in zoom-in duration-300"
            )}
            aria-label={t('my_notes', '\u041c\u043e\u0438 \u0437\u0430\u043f\u0438\u0441\u0438')}
          >
            <PremiumDocumentGlyph size={27} className="relative z-10 drop-shadow-[0_2px_8px_rgba(215,180,106,0.24)] transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col" side="right">
          <div className="h-full flex flex-col">
            <NotesPanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
