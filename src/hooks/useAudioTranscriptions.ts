import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Database } from '@/integrations/supabase/types';
import { legacyRetrievalUnsupported } from '@/lib/legacyRetrievalUnsupported';
import { rollbackCaseFile, uploadCaseFileWithMetadata } from '@/lib/caseFileUpload';
import {
  AUDIO_TRANSCRIPTION_SUPPORTED_LABEL,
  getAudioTranscriptionMime,
  isAudioTranscriptionSupportedFile,
} from '@/lib/uploadPolicies';

type AudioTranscription = Database['public']['Tables']['audio_transcriptions']['Row'];
type CaseFile = Database['public']['Tables']['case_files']['Row'];

export interface TranscriptionWithFile extends AudioTranscription {
  case_files: Pick<CaseFile, 'original_filename' | 'storage_path' | 'case_id'> | null;
}

export function useAudioTranscriptions(caseId: string | undefined) {
  const { toast } = useToast();
  const { t } = useTranslation(['audio', 'errors']);
  const queryClient = useQueryClient();

  // Get all transcriptions for a case
  const { data: transcriptions, isLoading, error } = useQuery({
    queryKey: ['audio-transcriptions', caseId],
    queryFn: async () => {
      if (!caseId) return [];
      
      const { data, error } = await supabase
        .from('audio_transcriptions')
        .select(`
          *,
          case_files!inner (
            original_filename,
            storage_path,
            case_id
          )
        `)
        .eq('case_files.case_id', caseId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TranscriptionWithFile[];
    },
    enabled: !!caseId,
  });

  // Upload and transcribe audio
  const uploadAndTranscribe = useMutation({
    mutationFn: async ({ file, caseId }: { file: File; caseId: string }) => {
      if (!isAudioTranscriptionSupportedFile(file)) {
        const contentType = getAudioTranscriptionMime(file);
        throw new Error(
          contentType
            ? `${t('audio:file_too_large')} Supported: ${AUDIO_TRANSCRIPTION_SUPPORTED_LABEL}.`
            : `${t('audio:unsupported_format')}. Supported: ${AUDIO_TRANSCRIPTION_SUPPORTED_LABEL}.`
        );
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let storagePath: string | null = null;
      let fileRecordId: string | null = null;
      let finalized = false;

      try {
        const contentType = getAudioTranscriptionMime(file);
        if (!contentType) throw new Error(t('audio:unsupported_format'));

        const uploadResult = await uploadCaseFileWithMetadata({ caseId, file, userId: user.id, contentType });
        storagePath = uploadResult.storagePath;
        fileRecordId = uploadResult.fileRecord.id;

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('case-files')
          .createSignedUrl(storagePath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          throw signedUrlError || new Error('Failed to get signed URL');
        }

        let transcriptionResult: { confidence_score?: number; error?: string; success?: boolean; [key: string]: unknown } | null = null;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const { data, error: fnError } = await supabase.functions
              .invoke('audio-transcribe', {
                body: {
                  audioUrl: signedUrlData.signedUrl,
                  fileName: file.name,
                  caseId,
                  fileId: fileRecordId,
                },
              });

            if (fnError) {
              const msg = fnError.message || String(fnError);
              if (msg.includes('Failed to send') && attempt < 1) {
                await new Promise(r => setTimeout(r, 3000));
                continue;
              }
              throw new Error(msg);
            }

            transcriptionResult = data;
            break;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < 1) {
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }
          }
        }

        if (!transcriptionResult || transcriptionResult.error || transcriptionResult.success === false) {
          throw lastError || new Error(transcriptionResult?.error || t('audio:processing_failed'));
        }

        finalized = true;
        return {
          fileRecord: uploadResult.fileRecord,
          transcription: transcriptionResult,
        };
      } catch (error) {
        if (!finalized) {
          await rollbackCaseFile(fileRecordId, storagePath);
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audio-transcriptions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-files', caseId] });
      
      const confidence = Number(data.transcription.confidence_score) || 0;
      const confidencePercent = Math.round(confidence * 100);
      
      toast({
        title: t('audio:processing_complete'),
        description: `${t('audio:confidence')}: ${confidencePercent}%`,
        variant: confidence >= 0.5 ? 'default' : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: t('audio:processing_failed'),
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['audio-transcriptions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-files', caseId] });
    },
  });

  // Update transcription (edit reviewed text)
  const updateTranscription = useMutation({
    mutationFn: async ({ 
      id, 
      transcriptionText, 
      needsReview 
    }: { 
      id: string; 
      transcriptionText: string; 
      needsReview?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('audio_transcriptions')
        .update({
          transcription_text: transcriptionText,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          needs_review: needsReview ?? false,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio-transcriptions', caseId] });
      toast({
        title: t('audio:save_changes'),
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

  // Add to Knowledge Base
  const addToKnowledgeBase = useMutation({
    mutationFn: async ({ 
      transcriptionId, 
      title, 
      category 
    }: { 
      transcriptionId: string; 
      title: string; 
      category: Database['public']['Enums']['kb_category'];
    }) => {
      void transcriptionId;
      void title;
      void category;
      throw legacyRetrievalUnsupported();
    },
    onSuccess: () => {
      toast({
        title: t('audio:kb_added'),
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

  // Delete transcription
  const deleteTranscription = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('audio_transcriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audio-transcriptions', caseId] });
      toast({
        title: t('audio:delete_transcription'),
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

  return {
    transcriptions: transcriptions || [],
    isLoading,
    error,
    uploadAndTranscribe,
    updateTranscription,
    addToKnowledgeBase,
    deleteTranscription,
  };
}
