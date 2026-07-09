import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import logo from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { CaseFilters } from '@/components/cases/CaseFilters';
import { CaseCard } from '@/components/cases/CaseCard';
import { CaseForm } from '@/components/cases/CaseForm';
import { UsageMonitor } from '@/components/UsageMonitor';
import { TeamStats } from '@/components/team/TeamStats';
import { LegalChatBot } from '@/components/chat/LegalChatBot';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { TelegramUploads } from '@/components/profile/TelegramUploads';
import { TelegramSettings } from '@/components/profile/TelegramSettings';
import { NotesBubble } from '@/components/notes/NotesBubble';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCases, type CaseFilters as CaseFiltersType } from '@/hooks/useCases';
import { useKnowledgeBase, type KBFilters as KBFiltersType } from '@/hooks/useKnowledgeBase';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  PremiumBrandMark,
  IconPlus,
  IconLoader,
  IconLogout,
  IconFolderOpen,
  IconBook,
  IconChart,
  IconUsers,
  IconCalendar,
  IconFile,
  IconMic,
  IconShieldAlert,
  IconExternal,
  IconArchive,
  IconSend,
  IconGavel,
  IconNote,
  IconBookText,
  IconCasesPremium,
  IconCalendarPremium,
  IconDocumentsPremium,
  IconTargetPremium,
  IconCalculatorPremium,
  IconMicPremium,
  IconArchivePremium,
  IconNotePremium,
  IconDictionaryPremium,
  IconTelegramPremium,
  IconExternalPremium,
  IconUsersPremium,
  IconSearchPremium,
  IconChartPremium,
  IconAiAnalysisPremium,
  IconMultiAgentPremium,
} from '@/components/icons/PremiumIcon';
import { DocumentGeneratorDialog } from '@/components/documents/DocumentGeneratorDialog';
import { ComplaintWizard } from '@/components/complaints/ComplaintWizard';
import { NotesPanel } from '@/components/notes/NotesPanel';
import { DictionarySearch } from '@/components/dictionary/DictionarySearch';
import { StandaloneAIAnalysis } from '@/components/standalone/StandaloneAIAnalysis';
import { StandaloneMultiAgent } from '@/components/standalone/StandaloneMultiAgent';
import { KBSearchFilters } from '@/components/kb/KBSearchFilters';
import { KBSearchPanel } from '@/components/kb/KBSearchPanel';
import { KBDocumentCard } from '@/components/kb/KBDocumentCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type Case = Database['public']['Tables']['cases']['Row'];

const Dashboard = () => {
  const { t } = useTranslation(['common', 'cases', 'dashboard', 'disclaimer', 'usage', 'kb', 'admin', 'dictionary']);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, isClient, isAdmin, isAuditor } = useAuth();

  const [filters, setFilters] = useState<CaseFiltersType>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [docGeneratorOpen, setDocGeneratorOpen] = useState(false);
  const [complaintWizardOpen, setComplaintWizardOpen] = useState(false);
  const [kbSearchOpen, setKbSearchOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [multiAgentOpen, setMultiAgentOpen] = useState(false);

  const [kbFilters, setKbFilters] = useState<KBFiltersType>({ page: 1, pageSize: 10 });

  const { cases, isLoading, createCase, updateCase, deleteCase } = useCases(filters);
  const { documents: kbDocuments, isLoading: kbLoading } = useKnowledgeBase(kbFilters);

  // Helper function to upload files after case creation
  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

  const uploadFilesToCase = async (caseId: string, files: File[]) => {
    for (const file of files) {
      if (file.size > MAX_UPLOAD_SIZE) {
        console.warn(`Skipping oversized file: ${file.name} (${file.size} bytes)`);
        continue;
      }

      const fileId = crypto.randomUUID();
      const fileExt = file.name.split('.').pop();
      const storagePath = `${caseId}/${fileId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('case-files')
        .upload(storagePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { error: dbError } = await supabase.from('case_files').insert({
        case_id: caseId,
        filename: `${fileId}.${fileExt}`,
        original_filename: file.name,
        storage_path: storagePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        version: 1,
        uploaded_by: user?.id,
      });

      if (dbError) {
        await supabase.storage.from('case-files').remove([storagePath]);
        throw dbError;
      }
    }
  };

  const handleCreateCase = (data: Database['public']['Tables']['cases']['Insert'], files?: File[]) => {
    const caseData = {
      ...data,
      ...(isClient ? { client_id: user?.id } : { lawyer_id: user?.id }),
    };
    createCase.mutate(caseData, {
      onSuccess: async (newCase) => {
        try {
          if (files && files.length > 0 && newCase?.id) {
            await uploadFilesToCase(newCase.id, files);
            toast({
              title: t('cases:file_uploaded'),
              variant: 'default',
            });
          }
          setFormOpen(false);
        } catch (error) {
          toast({
            title: t('errors:operation_failed'),
            description: error instanceof Error ? error.message : 'Upload failed',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const handleUpdateCase = (data: Database['public']['Tables']['cases']['Update']) => {
    if (editingCase) {
      updateCase.mutate(
        { id: editingCase.id, updates: data },
        { onSuccess: () => setEditingCase(null) }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingCaseId) {
      deleteCase.mutate(deletingCaseId);
      setDeletingCaseId(null);
    }
  };

  // Allow all authenticated users to create cases
  const canCreateCase = !!user;

  const sidebarItems = [
    { icon: <IconCasesPremium size={20} />, label: t('cases:cases'), active: true, onClick: () => navigate('/dashboard') },
    { icon: <IconCalendarPremium size={20} />, label: t('calendar:calendar', 'Calendar'), onClick: () => navigate('/calendar') },
    { icon: <IconMicPremium size={20} />, label: t('audio:audio', 'Audio/Video'), onClick: () => navigate('/transcriptions') },
    { icon: <IconDocumentsPremium size={20} />, label: t('common:documents', 'Documents'), onClick: () => setDocGeneratorOpen(true) },
    { icon: <IconArchivePremium size={20} />, label: t('common:my_documents'), onClick: () => navigate('/my-documents') },
    { icon: <IconTargetPremium size={20} />, label: t('common:complaint'), onClick: () => setComplaintWizardOpen(true) },
    { icon: <IconNotePremium size={20} />, label: t('common:my_notes', 'My Notes'), onClick: () => setNotesOpen(true) },
    { icon: <IconDictionaryPremium size={20} />, label: t('dictionary:dictionary', 'Dictionary'), onClick: () => setDictOpen(true) },
    { icon: <IconExternalPremium size={20} />, label: 'E-request', onClick: () => window.open('https://e-request.am', '_blank') },
    { icon: <IconTelegramPremium size={20} />, label: 'Telegram', onClick: () => setTelegramOpen(true) },
    { icon: <IconAiAnalysisPremium size={20} />, label: t('dashboard:ai_analysis', 'AI Analysis'), onClick: () => setAiAnalysisOpen(true) },
    { icon: <IconMultiAgentPremium size={20} />, label: t('dashboard:multi_agent', 'Multi-agent Analysis'), onClick: () => setMultiAgentOpen(true) },
  ];

  const Pill = ({
    icon,
    label,
    onClick,
    asChild,
    children,
  }: {
    icon: React.ReactNode;
    label: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    children?: React.ReactNode;
  }) => {
    const cls = 'pill-premium flex-col sm:flex-row h-auto py-2 sm:py-2 sm:h-11 justify-center text-center';
    if (asChild) {
      return (
        <SheetTrigger asChild>
          <button className={cls} type="button">
            <span className="flex items-center justify-center text-[#D7B46A]">{icon}</span>
            <span className="text-xs sm:text-sm mt-1 sm:mt-0 sm:ml-1">{label}</span>
          </button>
        </SheetTrigger>
      );
    }
    return (
      <button className={cls} onClick={onClick} type="button">
        <span className="flex items-center justify-center text-[#D7B46A]">{icon}</span>
        <span className="text-xs sm:text-sm mt-1 sm:mt-0 sm:ml-1">{label}</span>
      </button>
    );
  };

  return (
    <div className="dark h-screen overflow-hidden surface-bg lg:flex">
      <aside className="premium-sidebar hidden lg:flex">
        <div className="flex items-center gap-3 px-5 py-7">
          <img src={logo} alt="AI Legal Armenia" className="w-12 h-12 object-contain drop-shadow-[0_3px_14px_rgba(215,180,106,0.28)]" />
          <span className="text-xl font-serif tracking-wide text-[#D7B46A]" style={{ fontFamily: 'Playfair Display, Cormorant Garamond, serif', fontWeight: 600 }}>
            AI Legal Armenia
          </span>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 px-4">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="nav-item-premium"
              data-active={item.active ? 'true' : undefined}
              onClick={item.onClick}
            >
              <span className="text-[hsl(38_56%_70%)]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-5">
          <button className="nav-item-premium w-full" type="button">
            <span className="text-[hsl(38_56%_70%)]"><IconChartPremium size={20} /></span>
            <span>Settings</span>
          </button>
          <button className="nav-item-premium mt-1 w-full" type="button">
            <span className="text-[hsl(38_56%_70%)]"><IconDictionaryPremium size={20} /></span>
            <span>Help</span>
          </button>
          <div className="mt-6 flex items-center gap-3 px-2">
            <div className="h-12 w-12 rounded-full overflow-hidden border border-[rgba(215,180,106,0.3)] shadow-[0_0_12px_rgba(215,180,106,0.2)] flex-shrink-0 bg-[#0B1020]">
              <img 
                src={`/avatars/${isAdmin ? 'admin' : isClient ? 'client' : isAuditor ? 'auditor' : 'lawyer'}.png`} 
                alt="Role Crest" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[hsl(213_30%_92%)]">
                {user?.email?.split('@')[0] || 'E. Mason'}
              </div>
              <div className="text-meta">
                {isAdmin ? 'Administrator' : isClient ? 'Client' : isAuditor ? 'Auditor' : 'Lawyer'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 z-20 glass-header">
        <div className="mx-auto flex h-16 max-w-full items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="text-[hsl(38,56%,63%)] lg:hidden">
              <img src={logo} alt="Logo" className="w-8 h-8 object-contain drop-shadow-md" />
            </span>
            <h1 className="hidden text-section xs:block lg:hidden" style={{ fontSize: 22 }}>
              {t('common:app_name')}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden sm:block text-meta truncate max-w-[120px]">
              {user?.email}
            </span>
            <LanguageSwitcher />
            <button className="btn-ghost-premium" onClick={() => signOut()} aria-label="Logout">
              <IconLogout size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto mx-auto max-w-full w-full px-4 py-6 sm:py-8 lg:px-8 lg:py-10">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-title" style={{ fontSize: 34 }}>{t('cases:cases')}</h2>
              <p className="text-meta mt-2 text-[hsl(215_18%_60%)]">
                {t('dashboard:manage_cases', 'Manage your legal cases')}
              </p>
            </div>
            {canCreateCase && (
              <button onClick={() => setFormOpen(true)} className="btn-gold sm:hidden" aria-label="New case">
                <IconPlus size={18} />
              </button>
            )}
          </div>
          <div className="premium-tabs-bar grid grid-cols-3 gap-2.5 sm:flex sm:flex-wrap">
            {/* AI Legal Chat bubble is always visible as floating button */}
            {/* Unified Search */}
            <Sheet open={kbSearchOpen} onOpenChange={setKbSearchOpen}>
              <Pill
                asChild
                icon={<IconSearchPremium size={16} />}
                label={t('common:search', 'Search')}
              />
              <SheetContent className="w-full sm:max-w-2xl overflow-y-auto surface-panel backdrop-blur-[8px]">
                <SheetHeader>
                  <SheetTitle>{t('common:search', 'Search')}</SheetTitle>
                  <SheetDescription>
                    {t('dashboard:search_kb')}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {/* Legislation search */}
                  <KBSearchFilters filters={kbFilters} onFiltersChange={setKbFilters} />
                  {kbLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <IconLoader size={24} />
                    </div>
                  ) : kbDocuments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      {t('kb:no_results')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {kbDocuments.map((doc) => (
                        <KBDocumentCard
                          key={doc.id}
                          document={doc}
                          isAdmin={false}
                          rank={'relevancePct' in doc ? (doc.relevancePct as number) : 'rank' in doc ? (doc.rank as number) : undefined}
                          searchQuery={kbFilters.search}
                        />
                      ))}
                    </div>
                  )}
                  {/* Judicial Practice search */}
                  <div className="pt-4">
                    <div className="divider-subtle mb-4" />
                    <h3 className="text-card-title mb-3 flex items-center gap-2" style={{ fontSize: 18 }}>
                      <span className="text-[hsl(38,56%,63%)]">
                        <IconGavel size={18} />
                      </span>
                      {t('kb:tab_practice', 'Դատական պրակտիկա')}
                    </h3>
                    <KBSearchPanel />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Pill icon={<IconCalendarPremium size={16} />} label={t('calendar:calendar', 'Calendar')} onClick={() => navigate('/calendar')} />
            <Pill icon={<IconMicPremium size={16} />} label={t('audio:audio', 'Audio')} onClick={() => navigate('/transcriptions')} />
            <Pill icon={<IconDocumentsPremium size={16} />} label={t('common:documents', 'Documents')} onClick={() => setDocGeneratorOpen(true)} />
            <Pill icon={<IconArchivePremium size={16} />} label={t('common:my_documents')} onClick={() => navigate('/my-documents')} />
            <Pill icon={<IconTargetPremium size={16} />} label={t('common:complaint')} onClick={() => setComplaintWizardOpen(true)} />
            {/* Notes Editor */}
            <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
              <Pill asChild icon={<IconNotePremium size={16} />} label={t('common:my_notes', 'Իմ գրառումներ')} />
              <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col surface-panel" side="right">
                <div className="h-full flex flex-col">
                  <NotesPanel />
                </div>
              </SheetContent>
            </Sheet>
            {/* Dictionary */}
            <Sheet open={dictOpen} onOpenChange={setDictOpen}>
              <Pill asChild icon={<IconDictionaryPremium size={16} />} label={t('dictionary:dictionary', 'Բառարան')} />
              <SheetContent className="w-full sm:max-w-2xl overflow-y-auto surface-panel">
                <SheetHeader>
                  <SheetTitle>{t('dictionary:dictionary', 'Բառարան')}</SheetTitle>
                  <SheetDescription>
                    {t('dictionary:search_placeholder', 'Որոնել բառ...')}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <DictionarySearch />
                </div>
              </SheetContent>
            </Sheet>
            <Pill icon={<IconExternalPremium size={16} />} label="E-request" onClick={() => window.open('https://e-request.am', '_blank')} />
            {/* AI Analysis */}
            <Sheet open={aiAnalysisOpen} onOpenChange={setAiAnalysisOpen}>
              <Pill asChild icon={<IconAiAnalysisPremium size={16} />} label={t('dashboard:ai_analysis', 'AI Analysis')} />
              <SheetContent className="w-full sm:max-w-2xl overflow-y-auto surface-panel" side="right">
                <SheetHeader>
                  <SheetTitle>{t('dashboard:ai_analysis', 'AI Analysis')}</SheetTitle>
                  <SheetDescription>
                    {t('dashboard:ai_analysis_desc', 'Analyze facts and legal questions')}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 h-[calc(100vh-120px)]">
                  <StandaloneAIAnalysis />
                </div>
              </SheetContent>
            </Sheet>
            {/* Multi-Agent Analysis */}
            <Sheet open={multiAgentOpen} onOpenChange={setMultiAgentOpen}>
              <Pill asChild icon={<IconMultiAgentPremium size={16} />} label={t('dashboard:multi_agent', 'Multi-agent Analysis')} />
              <SheetContent className="w-full sm:max-w-3xl overflow-y-auto surface-panel" side="right">
                <SheetHeader>
                  <SheetTitle>{t('dashboard:multi_agent', 'Multi-agent Analysis')}</SheetTitle>
                  <SheetDescription>
                    {t('dashboard:multi_agent_desc', 'Run comprehensive multi-agent legal analysis')}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 h-[calc(100vh-120px)]">
                  <StandaloneMultiAgent />
                </div>
              </SheetContent>
            </Sheet>
            {/* Telegram Uploads */}
            <Sheet open={telegramOpen} onOpenChange={setTelegramOpen}>
              <Pill asChild icon={<IconTelegramPremium size={16} />} label="Telegram" />
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto surface-panel">
                <SheetHeader>
                  <SheetTitle>{t('common:telegram_files', 'Telegram Files')}</SheetTitle>
                  <SheetDescription>
                    {t('common:telegram_files_desc', 'Files sent via Telegram bot')}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <TelegramSettings />
                  <div className="pt-4">
                    <div className="divider-subtle mb-4" />
                    <h4 className="text-card-title mb-3" style={{ fontSize: 16 }}>{t('common:uploaded_files', 'Uploaded files')}</h4>
                    <TelegramUploads />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            {/* KB Management - Admin only */}
            {isAdmin && (
              <Pill icon={<IconDictionaryPremium size={16} />} label={t('kb:kb_short', 'KB')} onClick={() => navigate('/kb')} />
            )}
            {isAdmin && (
              <Sheet>
              <Pill asChild icon={<IconChartPremium size={16} />} label={t('usage:usage')} />
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto surface-panel">
                  <SheetHeader>
                    <SheetTitle>{t('usage:usage_title')}</SheetTitle>
                    <SheetDescription>
                      {t('usage:monthly_usage')}
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <UsageMonitor budgetLimit={5.0} showChart={true} showTopUsers={true} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        {/* Dashboard Tabs for Auditors */}
        {isAuditor ? (
          <Tabs defaultValue="team" className="space-y-4">
            <TabsList className="surface-panel rounded-[18px] p-2">
              <TabsTrigger value="team" className="gap-2 rounded-[14px]">
                <IconUsersPremium size={16} />
                {t('admin:my_team')}
              </TabsTrigger>
              <TabsTrigger value="cases" className="gap-2 rounded-[14px]">
                <IconCasesPremium size={16} />
                {t('admin:cases')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="team">
              <TeamStats />
            </TabsContent>

            <TabsContent value="cases" className="space-y-4">
              {/* Filters */}
              <div className="case-toolbar">
                {canCreateCase && (
                  <button onClick={() => setFormOpen(true)} className="btn-gold hidden min-w-[170px] sm:inline-flex">
                    <IconPlus size={18} />
                    {t('cases:new_case')}
                  </button>
                )}
                <CaseFilters filters={filters} onFiltersChange={setFilters} />
              </div>

              {/* Cases Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <IconLoader size={32} />
                </div>
              ) : cases.length === 0 ? (
                <div className="flex flex-col items-center justify-center surface-card py-16">
                  <IconCasesPremium size={48} />
                  <p className="mt-4 text-card-title text-muted-foreground" style={{ fontSize: 18 }}>
                    {t('cases:no_cases')}
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {cases.map((caseItem) => (
                    <CaseCard
                      key={caseItem.id}
                      caseData={caseItem}
                      onView={(id) => navigate(`/cases/${id}`)}
                      onEdit={(id) => {
                        const caseToEdit = cases.find(c => c.id === id);
                        if (caseToEdit) setEditingCase(caseToEdit);
                      }}
                      onDelete={(id) => setDeletingCaseId(id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Filters */}
            <div className="case-toolbar mb-6">
              {canCreateCase && (
                <button onClick={() => setFormOpen(true)} className="btn-gold hidden min-w-[170px] sm:inline-flex">
                  <IconPlus size={18} />
                  {t('cases:new_case')}
                </button>
              )}
              <CaseFilters filters={filters} onFiltersChange={setFilters} />
            </div>

            {/* Cases Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <IconLoader size={32} />
              </div>
            ) : cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center surface-card py-16">
                <IconCasesPremium size={48} />
                  <p className="mt-4 text-card-title text-muted-foreground" style={{ fontSize: 18 }}>
                    {t('cases:no_cases')}
                  </p>
                {canCreateCase && (
                  <button className="btn-gold mt-5" onClick={() => setFormOpen(true)}>
                    <IconPlus size={18} />
                    {t('cases:new_case')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseData={caseItem}
                    onView={(id) => navigate(`/cases/${id}`)}
                    onEdit={(id) => {
                      const caseToEdit = cases.find(c => c.id === id);
                      if (caseToEdit) setEditingCase(caseToEdit);
                    }}
                    onDelete={(id) => setDeletingCaseId(id)}
                  />
                ))}
              </div>
            )}

          </>
        )}

        {/* Legal Disclaimer */}
        <div className="mt-8 surface-card p-4" style={{ borderColor: 'rgba(217,160,60,0.28)' }}>
          <p className="text-body" style={{ color: 'hsl(38,70%,72%)' }}>
            {'⚠️'} {t('disclaimer:main')}
          </p>
        </div>
      </main>

      {/* Create/Edit Form */}
      <CaseForm
        open={formOpen || !!editingCase}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingCase(null);
          }
        }}
        onSubmit={editingCase ? handleUpdateCase : handleCreateCase}
        initialData={editingCase}
        isLoading={createCase.isPending || updateCase.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCaseId} onOpenChange={() => setDeletingCaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cases:delete_case')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cases:confirm_delete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('common:delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Persistent Legal AI Chat Bubble */}
      <ChatBubble />

      {/* Persistent Notes Bubble */}
      <NotesBubble />

      {/* Document Generator Dialog */}
      <DocumentGeneratorDialog
        open={docGeneratorOpen}
        onOpenChange={setDocGeneratorOpen}
      />

      {/* Complaint Wizard */}
      <ComplaintWizard
        open={complaintWizardOpen}
        onOpenChange={setComplaintWizardOpen}
      />
      </div>
    </div>
  );
};

export default Dashboard;
