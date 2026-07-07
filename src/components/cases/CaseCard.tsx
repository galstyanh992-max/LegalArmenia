import { useTranslation } from 'react-i18next';
import {
  GlyphBalance,
  GlyphColumns,
  GlyphShield,
  GlyphStamp,
  GlyphFile,
  GlyphFolder,
  GlyphGavel,
  IconActionVertical,
  IconCalendar,
  IconFile,
  IconFolder,
  IconGavel,
  IconPlus,
  IconSearch,
} from '@/components/icons/PremiumIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Case = Database['public']['Tables']['cases']['Row'];

interface CaseCardProps {
  caseData: Case;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusCapsules: Record<string, string> = {
  open: 'capsule capsule-open',
  in_progress: 'capsule capsule-ai',
  pending: 'capsule capsule-pending',
  closed: 'capsule capsule-court',
  archived: 'capsule capsule-ai',
};

const priorityCapsules: Record<string, string> = {
  low: 'capsule capsule-court',
  medium: 'capsule capsule-priority',
  high: 'capsule capsule-priority',
  urgent: 'capsule capsule-pending',
};

const glyphs = [GlyphBalance, GlyphFile, GlyphFolder, GlyphGavel, GlyphColumns, GlyphShield, GlyphStamp];

export function CaseCard({ caseData, onView, onEdit, onDelete }: CaseCardProps) {
  const { t } = useTranslation('cases');

  const isCourtDateUrgent = () => {
    if (!caseData.court_date) return false;
    const courtDate = new Date(caseData.court_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    courtDate.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    return courtDate >= today && courtDate <= sevenDaysFromNow;
  };

  const courtDateCapsule = isCourtDateUrgent() ? 'capsule capsule-pending' : 'capsule capsule-court';
  const Glyph = glyphs[caseData.id.charCodeAt(0) % glyphs.length];

  return (
    <article className="case-card-premium">
      <span className="card-glyph">
        <Glyph size={68} />
      </span>

      <div className="relative z-[1] flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h3 className="text-card-title truncate text-[hsl(213_30%_94%)]">
            {caseData.title}
          </h3>
          <p className="line-clamp-2 text-body text-[hsl(215_18%_68%)]">
            {caseData.case_number}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="case-action-button" type="button" aria-label={t('common:actions', 'Actions')}>
              <IconActionVertical size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(caseData.id)}>
              <IconSearch className="mr-2 h-4 w-4" />
              {t('view_case')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(caseData.id)}>
              <IconPlus className="mr-2 h-4 w-4" />
              {t('edit_case')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(caseData.id)}
              className="text-destructive focus:text-destructive"
            >
              <IconFolder className="mr-2 h-4 w-4" />
              {t('delete_case')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative z-[1] mt-3">
        {caseData.description && (
          <p className="mb-3 line-clamp-2 text-body text-[hsl(215_18%_68%)]">
            {caseData.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className={statusCapsules[caseData.status] || 'capsule capsule-court'}>
            {t(`status_${caseData.status}`)}
          </span>
          <span className={priorityCapsules[caseData.priority] || 'capsule capsule-priority'}>
            {t(`priority_${caseData.priority}`)}
          </span>
          <span className={courtDateCapsule}>
            {caseData.court_date
              ? `${t('court_hearing')} ${format(new Date(caseData.court_date), 'yyyy-MM-dd')}`
              : t('no_court_date')}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-meta text-[hsl(215_18%_66%)]">
          {caseData.court_date && (
            <div className="flex items-center gap-1">
              <IconCalendar className="h-3 w-3" />
              <span>{format(new Date(caseData.court_date), 'dd.MM.yyyy')}</span>
            </div>
          )}
          {caseData.court_name && (
            <div className="flex min-w-0 items-center gap-1">
              <IconFile className="h-3 w-3 shrink-0" />
              <span className="truncate">{caseData.court_name}</span>
            </div>
          )}
        </div>

        <div className="mt-3 text-meta text-[hsl(215_18%_62%)]">
          {t('created_at')}: {format(new Date(caseData.created_at), 'dd.MM.yyyy HH:mm')}
        </div>
      </div>
    </article>
  );
}
