import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiAgentPanel } from '@/components/agents/MultiAgentPanel';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function StandaloneMultiAgent() {
  const { t } = useTranslation(['cases', 'common']);
  const [facts, setFacts] = useState('');

  return (
    <div className="flex flex-col h-full space-y-6">
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
          caseId="standalone"
          caseFacts={facts}
          caseType="civil"
        />
      </div>
    </div>
  );
}
