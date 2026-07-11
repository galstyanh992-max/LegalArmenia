import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiAgentPanel } from '@/components/agents/MultiAgentPanel';
import { CaseFileUpload } from '@/components/cases/CaseFileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCases } from '@/hooks/useCases';
import { Loader2, FolderOpen } from 'lucide-react';

const STANDALONE = 'standalone';

export function StandaloneMultiAgent() {
  const { t } = useTranslation(['cases', 'common', 'dashboard']);
  const { cases, isLoading: casesLoading } = useCases();
  const [selectedCaseId, setSelectedCaseId] = useState<string>(STANDALONE);
  const [facts, setFacts] = useState('');

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId],
  );

  // Effective case id: real id when bound, otherwise standalone.
  const effectiveCaseId = selectedCaseId === STANDALONE ? 'standalone' : selectedCaseId;
  const isBoundToCase = selectedCaseId !== STANDALONE;

  const handleCaseChange = (value: string) => {
    setSelectedCaseId(value);
    const c = cases.find((x) => x.id === value);
    if (c) {
      setFacts(c.facts ?? '');
    }
  };

  const caseLabel = (c: { case_number: string | null; title: string }) =>
    `${c.case_number ?? ''} — ${c.title}`.slice(0, 80);

  // Derive case type for party-role mapping; default to civil for standalone.
  const caseType = selectedCase?.case_type ?? 'civil';

  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto w-full">
      {/* Case binding + file upload */}
      <div className="space-y-4 px-1">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-[#D7B46A]" />
            {t('dashboard:bind_to_case', 'Привязка к делу / Bind to case')}
          </Label>
          <Select value={selectedCaseId} onValueChange={handleCaseChange} disabled={casesLoading}>
            <SelectTrigger className="w-full">
              {casesLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common:loading', 'Загрузка...')}
                </span>
              ) : (
                <SelectValue placeholder={t('dashboard:select_case', 'Выберите дело')} />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STANDALONE}>
                {t('dashboard:standalone_no_case', 'Без привязки (без дела)')}
              </SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {caseLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File upload — enabled only when bound to a case. */}
        {isBoundToCase ? (
          <CaseFileUpload caseId={effectiveCaseId} />
        ) : (
          <div className="rounded-xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
            {t(
              'dashboard:upload_requires_case',
              'Выберите дело, чтобы прикрепить файлы анализа к этому делу.',
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 px-1">
        <div className="space-y-2">
          <Label>{t('cases:case_facts', 'Фабула дела')}</Label>
          <Textarea
            placeholder={t('cases:facts_placeholder', 'Введите факты для многоагентного анализа...')}
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            className="min-h-[100px] resize-y"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <MultiAgentPanel
          caseId={effectiveCaseId}
          caseFacts={facts}
          caseType={caseType}
        />
      </div>
    </div>
  );
}
