import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/reminders';
import logo from '@/assets/logo.png';

interface CaseDetailHeaderProps {
  userEmail?: string;
  onSignOut: () => void;
}

export function CaseDetailHeader({ userEmail, onSignOut }: CaseDetailHeaderProps) {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();

  return (
    <>
      {/* Header - Premium mobile styling */}
      <header className="shrink-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
        <div className="container-mobile mx-auto flex h-14 sm:h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AI Legal Armenia" className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-[0_2px_10px_rgba(215,180,106,0.3)]" />
            <h1 className="text-lg sm:text-xl font-bold hidden sm:block tracking-tight">{t('common:app_name')}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:block text-sm text-muted-foreground truncate max-w-[160px]">
              {userEmail}
            </span>
            <NotificationBell />
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" onClick={onSignOut} className="h-11 w-11">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Back Button - Touch-friendly */}
      <div className="container-mobile mx-auto pt-4 sm:pt-6">
        <Button 
          variant="ghost" 
          className="mb-3 sm:mb-4 h-11 px-4 rounded-xl text-muted-foreground hover:text-foreground" 
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          {t('common:back', 'Back')}
        </Button>
      </div>
    </>
  );
}
