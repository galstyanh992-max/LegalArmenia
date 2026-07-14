import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Database } from '@/integrations/supabase/types';
import { legacyRetrievalUnsupported } from '@/lib/legacyRetrievalUnsupported';

type KnowledgeBase = Database['public']['Tables']['knowledge_base']['Row'];
type KnowledgeBaseInsert = Database['public']['Tables']['knowledge_base']['Insert'];
type KnowledgeBaseUpdate = Database['public']['Tables']['knowledge_base']['Update'];
type KbCategory = Database['public']['Enums']['kb_category'];

export interface KBFilters {
  search?: string;
  category?: KbCategory | 'all';
  page?: number;
  pageSize?: number;
}

export interface KBSearchResult {
  id: string;
  title: string;
  content_text: string;
  category: KbCategory;
  source_name: string | null;
  version_date: string | null;
  rank: number | null;
  relevancePct?: number;
}

export interface KBChunkSearchResult {
  id: string;
  title: string;
  category: string;
  source_name: string | null;
  article_number: string | null;
  source_url: string | null;
  max_score: number;
  relevancePct: number;
  content_text: string; // first chunk excerpt as fallback
  chunks: Array<{
    doc_id: string;
    chunk_index: number;
    chunk_type: string;
    label: string | null;
    char_start: number;
    excerpt: string;
    full_text: string | null;
    score: number;
  }>;
}

export function useKnowledgeBase(filters: KBFilters = {}) {
  const { toast } = useToast();
  const { t } = useTranslation('kb');
  const queryClient = useQueryClient();

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  // Chunk-level search + fallback direct search
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['kb-search', filters.search, filters.category],
    queryFn: async () => {
      if (!filters.search || filters.search.length < 2) return null;

      const chunkDocs: KBChunkSearchResult[] = [];
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('kb-unified-search', {
        body: { query: filters.search, statusScope: 'extended' },
      });
      if (!edgeError && edgeData?.kb) {
        const docs = (edgeData.kb.documents || []) as Array<{
          id: string; title: string; category: string;
          source_name: string | null; article_number: string | null;
          source_url: string | null; max_score: number;
        }>;
        const chunks = (edgeData.kb.chunks || []) as KBChunkSearchResult['chunks'];
        const chunksByDoc = new Map<string, KBChunkSearchResult['chunks']>();
        for (const chunk of chunks) {
          const existing = chunksByDoc.get(chunk.doc_id) || [];
          existing.push(chunk);
          chunksByDoc.set(chunk.doc_id, existing);
        }
        const globalMax = docs.reduce((mx, d) => Math.max(mx, Number(d.max_score) || 0), 0);

        for (const doc of docs) {
          const raw = Number(doc.max_score) || 0;
          const relevancePct = globalMax > 0 ? Math.round((raw / globalMax) * 100) : 100;
          const docChunks = chunksByDoc.get(doc.id) || [];
          const excerpt = docChunks[0]?.excerpt || '';
          chunkDocs.push({
            ...doc,
            relevancePct,
            content_text: excerpt.substring(0, 500),
            chunks: docChunks,
          });
        }
      }

      const q = (filters.search || '').trim();
      const isArticleQuery = /^(?:\u0540\u0578\u0564\u057E\u0561\u056E|\u0540\u0578\u0564\.?|\u0421\u0442\u0430\u0442\u044C\u044F|\u0441\u0442\.?|Article|Art\.?)\s*\d+/i.test(q);

      return chunkDocs.filter((doc) => {
        if (isArticleQuery) return true;
        return doc.relevancePct >= 50;
      });
    },
    enabled: !!filters.search && filters.search.length >= 2,
  });

  // Legacy table browsing is disabled until a verified write/read mapping exists for documents/search_chunks.
  const { data: listData, isLoading: isListing } = useQuery({
    queryKey: ['kb-list', filters.category, page, pageSize],
    queryFn: async () => {
      return {
        items: [] as KnowledgeBase[],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    },
    enabled: !filters.search || filters.search.length < 2,
  });

  // Create document (admin only)
  const createDocument = useMutation({
    mutationFn: async (doc: KnowledgeBaseInsert) => {
      void doc;
      throw legacyRetrievalUnsupported();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-list'] });
      queryClient.invalidateQueries({ queryKey: ['kb-search'] });
      toast({ title: t('document_uploaded') });
    },
    onError: (error) => {
      toast({
        title: t('errors:operation_failed', 'Operation failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update document (admin only)
  const updateDocument = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: KnowledgeBaseUpdate }) => {
      void id;
      void updates;
      throw legacyRetrievalUnsupported();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-list'] });
      queryClient.invalidateQueries({ queryKey: ['kb-search'] });
      queryClient.invalidateQueries({ queryKey: ['kb-document'] });
      toast({ title: t('document_updated') });
    },
    onError: (error) => {
      toast({
        title: t('errors:operation_failed', 'Operation failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Soft delete (deactivate) document (admin only)
  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      void id;
      throw legacyRetrievalUnsupported();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-list'] });
      queryClient.invalidateQueries({ queryKey: ['kb-search'] });
      toast({ title: t('document_deleted') });
    },
    onError: (error) => {
      toast({
        title: t('errors:operation_failed', 'Operation failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isLoading = isSearching || isListing;
  const documents = filters.search && filters.search.length >= 2 
    ? searchResults || [] 
    : listData?.items || [];
  const pagination = listData ? {
    page: listData.page,
    pageSize: listData.pageSize,
    total: listData.total,
    totalPages: listData.totalPages,
  } : null;

  return {
    documents,
    pagination,
    isLoading,
    createDocument,
    updateDocument,
    deleteDocument,
  };
}

// Get single document
export function useKBDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['kb-document', id],
    queryFn: async () => {
      if (!id) return null;
      return await Promise.reject<KnowledgeBase | null>(legacyRetrievalUnsupported());
    },
    enabled: !!id,
  });
}

// Get version history for a document
export function useKBVersions(kbId: string | undefined) {
  return useQuery({
    queryKey: ['kb-versions', kbId],
    queryFn: async () => {
      if (!kbId) return [];
      return await Promise.reject<Database['public']['Tables']['kb_versions']['Row'][]>(legacyRetrievalUnsupported());
    },
    enabled: !!kbId,
  });
}
