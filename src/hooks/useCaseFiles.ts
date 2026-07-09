import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Database } from '@/integrations/supabase/types';
import { uploadCaseFileWithMetadata } from '@/lib/caseFileUpload';

type CaseFile = Database['public']['Tables']['case_files']['Row'];

export function useCaseFiles(caseId: string | undefined) {
  const { toast } = useToast();
  const { t } = useTranslation(['cases', 'errors']);
  const queryClient = useQueryClient();

  const { data: files, isLoading, error } = useQuery({
    queryKey: ['case-files', caseId],
    queryFn: async () => {
      if (!caseId) return [];
      const { data, error } = await supabase
        .from('case_files')
        .select('*')
        .eq('case_id', caseId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CaseFile[];
    },
    enabled: !!caseId,
  });

  const uploadFile = useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { fileRecord } = await uploadCaseFileWithMetadata({ caseId, file, userId: user.id });
      return fileRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-files', caseId] });
      toast({
        title: t('cases:file_uploaded', 'File uploaded successfully'),
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: t('errors:operation_failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      // F7.2: remove BOTH the DB row and the storage object, aligned RLS on each.
      // Order is row-first so a storage failure can only leave a harmless orphan
      // object — never "object gone while row remains".
      const { data: row } = await supabase
        .from('case_files')
        .select('storage_path')
        .eq('id', fileId)
        .maybeSingle();

      const { error } = await supabase.from('case_files').delete().eq('id', fileId);
      if (error) throw error;

      if (row?.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('case-files')
          .remove([row.storage_path]);
        if (storageError) throw storageError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-files', caseId] });
      toast({
        title: t('cases:file_deleted', 'File deleted'),
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: t('errors:operation_failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getFileUrl = async (storagePath: string) => {
    const { data, error } = await supabase.storage
      .from('case-files')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    if (error) throw error;
    return data.signedUrl;
  };

  return {
    files: files || [],
    isLoading,
    error,
    uploadFile,
    deleteFile,
    getFileUrl,
  };
}
