import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'hy', name: 'Հայերեն', flag: '🇦🇲' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation('common');
  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-10 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0F1523] px-3 text-sm text-[hsl(213_30%_92%)] shadow-sm outline-none transition-colors hover:border-[rgba(215,180,106,0.3)]">
          <Globe className="h-4 w-4 shrink-0 text-[hsl(38_56%_63%)]" />
          <span className="sr-only">Select language</span>
          <span className="min-w-0 pr-1">{currentLang.flag} {currentLang.name}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[140px] bg-[#0F1523] border border-white/10 text-[hsl(213_30%_92%)] shadow-xl">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`cursor-pointer focus:bg-white/10 focus:text-[hsl(38_56%_63%)] transition-colors ${currentLang.code === lang.code ? 'text-[hsl(38_56%_63%)] bg-white/5' : ''}`}
          >
            {lang.flag} <span className="ml-2 font-medium">{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
