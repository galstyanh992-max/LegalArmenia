import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaseAIAnalysisPanel } from '@/components/cases/CaseAIAnalysisPanel';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function StandaloneAIAnalysis() {
  const { t } = useTranslation(['cases', 'common']);
  const [facts, setFacts] = useState('');
  const [legalQuestion, setLegalQuestion] = useState('');

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="space-y-4 px-1">
        <div className="space-y-2">
          <Label>{t('cases:case_facts', 'Фабула дела')}</Label>
          <Textarea
            placeholder={t('cases:facts_placeholder', 'Введите факты...')}
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            className="min-h-[100px] resize-y"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('cases:legal_question', 'Правовой вопрос')}</Label>
          <Textarea
            placeholder={t('cases:question_placeholder', 'Что вы хотите выяснить?...')}
            value={legalQuestion}
            onChange={(e) => setLegalQuestion(e.target.value)}
            className="min-h-[60px] resize-y"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <CaseAIAnalysisPanel
          caseId="standalone"
          caseNumber="Standalone"
          caseTitle="Standalone Analysis"
          facts={facts}
          legalQuestion={legalQuestion}
          aiCreditsExhausted={false}
          onOpenComplaintGenerator={() => {}}
        />
      </div>
    </div>
  );
}
