export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_analysis_runs: {
        Row: {
          agent_type: string
          analysis_result: Json | null
          case_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          findings: Json
          id: string
          sources_used: Json
          started_at: string | null
          status: string
          summary: string | null
          tokens_used: number | null
          updated_at: string
        }
        Insert: {
          agent_type: string
          analysis_result?: Json | null
          case_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          findings?: Json
          id?: string
          sources_used?: Json
          started_at?: string | null
          status?: string
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
        }
        Update: {
          agent_type?: string
          analysis_result?: Json | null
          case_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          findings?: Json
          id?: string
          sources_used?: Json
          started_at?: string | null
          status?: string
          summary?: string | null
          tokens_used?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_findings: {
        Row: {
          agent_run_id: string | null
          case_id: string
          created_at: string
          description: string | null
          evidence_refs: Json
          finding_type: string | null
          id: string
          legal_basis: Json | null
          page_references: Json
          recommendation: string | null
          severity: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_run_id?: string | null
          case_id: string
          created_at?: string
          description?: string | null
          evidence_refs?: Json
          finding_type?: string | null
          id?: string
          legal_basis?: Json | null
          page_references?: Json
          recommendation?: string | null
          severity?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_run_id?: string | null
          case_id?: string
          created_at?: string
          description?: string | null
          evidence_refs?: Json
          finding_type?: string | null
          id?: string
          legal_basis?: Json | null
          page_references?: Json
          recommendation?: string | null
          severity?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_findings_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregated_reports: {
        Row: {
          agent_runs: Json
          case_id: string
          created_at: string
          data_gaps: Json | null
          defense_strategy: string | null
          evidence_summary: string | null
          executive_summary: string | null
          full_report: string | null
          generated_at: string
          id: string
          prosecution_weaknesses: string | null
          recommendations: string | null
          report_type: string | null
          statistics: Json | null
          title: string | null
          updated_at: string
          violations_summary: string | null
          warnings: Json | null
        }
        Insert: {
          agent_runs?: Json
          case_id: string
          created_at?: string
          data_gaps?: Json | null
          defense_strategy?: string | null
          evidence_summary?: string | null
          executive_summary?: string | null
          full_report?: string | null
          generated_at?: string
          id?: string
          prosecution_weaknesses?: string | null
          recommendations?: string | null
          report_type?: string | null
          statistics?: Json | null
          title?: string | null
          updated_at?: string
          violations_summary?: string | null
          warnings?: Json | null
        }
        Update: {
          agent_runs?: Json
          case_id?: string
          created_at?: string
          data_gaps?: Json | null
          defense_strategy?: string | null
          evidence_summary?: string | null
          executive_summary?: string | null
          full_report?: string | null
          generated_at?: string
          id?: string
          prosecution_weaknesses?: string | null
          recommendations?: string | null
          report_type?: string | null
          statistics?: Json | null
          title?: string | null
          updated_at?: string
          violations_summary?: string | null
          warnings?: Json | null
        }
        Relationships: []
      }
      ai_prompt_versions: {
        Row: {
          change_reason: string | null
          changed_at: string
          id: string
          prompt_id: string
          prompt_text: string
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          id?: string
          prompt_id: string
          prompt_text: string
          version_number: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          id?: string
          prompt_id?: string
          prompt_text?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          created_at: string
          current_version: number
          description: string | null
          function_name: string
          id: string
          is_active: boolean
          module_type: string
          name_en: string | null
          name_hy: string
          name_ru: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version?: number
          description?: string | null
          function_name: string
          id?: string
          is_active?: boolean
          module_type: string
          name_en?: string | null
          name_hy?: string
          name_ru?: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version?: number
          description?: string | null
          function_name?: string
          id?: string
          is_active?: boolean
          module_type?: string
          name_en?: string | null
          name_hy?: string
          name_ru?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audio_transcriptions: {
        Row: {
          confidence: number | null
          created_at: string
          duration_seconds: number | null
          file_id: string | null
          id: string
          language: string | null
          needs_review: boolean | null
          reviewed_by: string | null
          transcription_text: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          duration_seconds?: number | null
          file_id?: string | null
          id?: string
          language?: string | null
          needs_review?: boolean | null
          reviewed_by?: string | null
          transcription_text?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          duration_seconds?: number | null
          file_id?: string | null
          id?: string
          language?: string | null
          needs_review?: boolean | null
          reviewed_by?: string | null
          transcription_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_transcriptions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      authorities: {
        Row: {
          authority_id: string
          authority_type: string | null
          created_at: string
          name_normalized: string | null
          name_raw: string
          updated_at: string
        }
        Insert: {
          authority_id?: string
          authority_type?: string | null
          created_at?: string
          name_normalized?: string | null
          name_raw: string
          updated_at?: string
        }
        Update: {
          authority_id?: string
          authority_type?: string | null
          created_at?: string
          name_normalized?: string | null
          name_raw?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_comments: {
        Row: {
          author_id: string
          case_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          case_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          case_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_comments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_parties: {
        Row: {
          case_party_id: string
          court_case_id: string
          created_at: string
          party_id: string
          party_role: string | null
          updated_at: string
        }
        Insert: {
          case_party_id?: string
          court_case_id: string
          created_at?: string
          party_id: string
          party_role?: string | null
          updated_at?: string
        }
        Update: {
          case_party_id?: string
          court_case_id?: string
          created_at?: string
          party_id?: string
          party_role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_parties_court_case_id_fkey"
            columns: ["court_case_id"]
            isOneToOne: false
            referencedRelation: "court_cases"
            referencedColumns: ["court_case_id"]
          },
          {
            foreignKeyName: "case_parties_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["party_id"]
          },
        ]
      }
      case_volumes: {
        Row: {
          case_id: string
          created_at: string
          file_id: string | null
          id: string
          metadata: Json
          ocr_text: string | null
          title: string | null
          updated_at: string
          volume_number: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          file_id?: string | null
          id?: string
          metadata?: Json
          ocr_text?: string | null
          title?: string | null
          updated_at?: string
          volume_number?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          file_id?: string | null
          id?: string
          metadata?: Json
          ocr_text?: string | null
          title?: string | null
          updated_at?: string
          volume_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_volumes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_volumes_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "case_files"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
          sources: Json | null
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      court_cases: {
        Row: {
          case_number: string | null
          court_case_id: string
          court_name: string | null
          created_at: string
          document_id: string | null
          hearing_date: string | null
          updated_at: string
          verdict_date: string | null
        }
        Insert: {
          case_number?: string | null
          court_case_id?: string
          court_name?: string | null
          created_at?: string
          document_id?: string | null
          hearing_date?: string | null
          updated_at?: string
          verdict_date?: string | null
        }
        Update: {
          case_number?: string | null
          court_case_id?: string
          court_name?: string | null
          created_at?: string
          document_id?: string | null
          hearing_date?: string | null
          updated_at?: string
          verdict_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_cases_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      document_pages: {
        Row: {
          created_at: string
          page_id: string
          page_number: number
          page_text: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          page_id?: string
          page_number: number
          page_text?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          page_id?: string
          page_number?: number
          page_text?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      document_references: {
        Row: {
          created_at: string
          from_document_id: string
          reference_id: string
          reference_text: string | null
          reference_type: string | null
          to_document_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_document_id: string
          reference_id?: string
          reference_text?: string | null
          reference_type?: string | null
          to_document_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_document_id?: string
          reference_id?: string
          reference_text?: string | null
          reference_type?: string | null
          to_document_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_references_from_document_id_fkey"
            columns: ["from_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_references_to_document_id_fkey"
            columns: ["to_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      document_table_cells: {
        Row: {
          cell_confidence: number | null
          cell_id: string
          col_idx: number
          row_idx: number
          table_id: string
          value_norm: string | null
          value_raw: string | null
          value_type: string | null
        }
        Insert: {
          cell_confidence?: number | null
          cell_id?: string
          col_idx: number
          row_idx: number
          table_id: string
          value_norm?: string | null
          value_raw?: string | null
          value_type?: string | null
        }
        Update: {
          cell_confidence?: number | null
          cell_id?: string
          col_idx?: number
          row_idx?: number
          table_id?: string
          value_norm?: string | null
          value_raw?: string | null
          value_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_table_cells_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "document_tables"
            referencedColumns: ["table_id"]
          },
        ]
      }
      document_tables: {
        Row: {
          created_at: string
          document_id: string
          extraction_confidence: number | null
          extraction_tool: string | null
          headers: Json | null
          index_on_page: number | null
          n_cols: number | null
          n_rows: number | null
          needs_human_review: boolean
          page_from: number | null
          page_to: number | null
          source_sha256: string | null
          table_class: string | null
          table_id: string
          table_markdown: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          extraction_confidence?: number | null
          extraction_tool?: string | null
          headers?: Json | null
          index_on_page?: number | null
          n_cols?: number | null
          n_rows?: number | null
          needs_human_review?: boolean
          page_from?: number | null
          page_to?: number | null
          source_sha256?: string | null
          table_class?: string | null
          table_id?: string
          table_markdown?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          extraction_confidence?: number | null
          extraction_tool?: string | null
          headers?: Json | null
          index_on_page?: number | null
          n_cols?: number | null
          n_rows?: number | null
          needs_human_review?: boolean
          page_from?: number | null
          page_to?: number | null
          source_sha256?: string | null
          table_class?: string | null
          table_id?: string
          table_markdown?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tables_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_tables_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name_en: string | null
          name_hy: string
          name_ru: string
          required_fields: Json
          subcategory: string | null
          template_text: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_hy?: string
          name_ru?: string
          required_fields?: Json
          subcategory?: string | null
          template_text?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name_en?: string | null
          name_hy?: string
          name_ru?: string
          required_fields?: Json
          subcategory?: string | null
          template_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_topics: {
        Row: {
          assigned_by: string | null
          confidence: number | null
          created_at: string
          document_id: string
          document_topic_id: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          confidence?: number | null
          created_at?: string
          document_id: string
          document_topic_id?: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          confidence?: number | null
          created_at?: string
          document_id?: string
          document_topic_id?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_topics_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string
          created_at: string
          document_type_id: string
          label_en: string | null
          label_hy: string | null
          label_ru: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          document_type_id?: string
          label_en?: string | null
          label_hy?: string | null
          label_ru?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          document_type_id?: string
          label_en?: string | null
          label_hy?: string | null
          label_ru?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          full_text: string | null
          is_current: boolean
          language_code: string
          page_count: number | null
          publication_source_id: string | null
          published_at: string | null
          source_file_id: string | null
          text_sha256: string | null
          updated_at: string
          version_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          document_id: string
          full_text?: string | null
          is_current?: boolean
          language_code?: string
          page_count?: number | null
          publication_source_id?: string | null
          published_at?: string | null
          source_file_id?: string | null
          text_sha256?: string | null
          updated_at?: string
          version_id?: string
          version_number: number
        }
        Update: {
          created_at?: string
          document_id?: string
          full_text?: string | null
          is_current?: boolean
          language_code?: string
          page_count?: number | null
          publication_source_id?: string | null
          published_at?: string | null
          source_file_id?: string | null
          text_sha256?: string | null
          updated_at?: string
          version_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_versions_publication_source_id_fkey"
            columns: ["publication_source_id"]
            isOneToOne: false
            referencedRelation: "publication_sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      documents: {
        Row: {
          arlis_doc_id: string | null
          canonical_key: string | null
          content_domain: Database["public"]["Enums"]["content_domain"]
          created_at: string
          doc_number_clean: string | null
          doc_number_raw: string | null
          document_id: string
          document_type_id: string | null
          effective_from: string | null
          effective_to: string | null
          issued_date: string | null
          jurisdiction_id: string | null
          needs_human_review: boolean
          normalized_status: Database["public"]["Enums"]["normalized_status"]
          quality_flags: Json
          raw_status: string | null
          source_metadata: Json | null
          title_en: string | null
          title_hy: string | null
          title_ru: string | null
          updated_at: string
        }
        Insert: {
          arlis_doc_id?: string | null
          canonical_key?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"]
          created_at?: string
          doc_number_clean?: string | null
          doc_number_raw?: string | null
          document_id?: string
          document_type_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          issued_date?: string | null
          jurisdiction_id?: string | null
          needs_human_review?: boolean
          normalized_status?: Database["public"]["Enums"]["normalized_status"]
          quality_flags?: Json
          raw_status?: string | null
          source_metadata?: Json | null
          title_en?: string | null
          title_hy?: string | null
          title_ru?: string | null
          updated_at?: string
        }
        Update: {
          arlis_doc_id?: string | null
          canonical_key?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"]
          created_at?: string
          doc_number_clean?: string | null
          doc_number_raw?: string | null
          document_id?: string
          document_type_id?: string | null
          effective_from?: string | null
          effective_to?: string | null
          issued_date?: string | null
          jurisdiction_id?: string | null
          needs_human_review?: boolean
          normalized_status?: Database["public"]["Enums"]["normalized_status"]
          quality_flags?: Json
          raw_status?: string | null
          source_metadata?: Json | null
          title_en?: string | null
          title_hy?: string | null
          title_ru?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["document_type_id"]
          },
          {
            foreignKeyName: "documents_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["jurisdiction_id"]
          },
        ]
      }
      embeddings: {
        Row: {
          chunk_id: string
          chunk_text_sha256: string | null
          created_at: string
          dimension: number
          embedding_id: string
          error_message: string | null
          model: string
          status: string
          updated_at: string
          vector: string | null
        }
        Insert: {
          chunk_id: string
          chunk_text_sha256?: string | null
          created_at?: string
          dimension: number
          embedding_id?: string
          error_message?: string | null
          model: string
          status?: string
          updated_at?: string
          vector?: string | null
        }
        Update: {
          chunk_id?: string
          chunk_text_sha256?: string | null
          created_at?: string
          dimension?: number
          embedding_id?: string
          error_message?: string | null
          model?: string
          status?: string
          updated_at?: string
          vector?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks"
            referencedColumns: ["chunk_id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string
          error_message: string | null
          error_stack: string | null
          error_type: string | null
          id: string
          resolved: boolean
          resolved_at: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          error_type?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      evidence_registry: {
        Row: {
          admissibility_notes: string | null
          admissibility_status: string | null
          ai_analysis: string | null
          case_id: string
          created_at: string
          description: string | null
          evidence_number: number | null
          evidence_type: string | null
          id: string
          metadata: Json | null
          page_reference: string | null
          source_document: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          admissibility_notes?: string | null
          admissibility_status?: string | null
          ai_analysis?: string | null
          case_id: string
          created_at?: string
          description?: string | null
          evidence_number?: number | null
          evidence_type?: string | null
          id?: string
          metadata?: Json | null
          page_reference?: string | null
          source_document?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          admissibility_notes?: string | null
          admissibility_status?: string | null
          ai_analysis?: string | null
          case_id?: string
          created_at?: string
          description?: string | null
          evidence_number?: number | null
          evidence_type?: string | null
          id?: string
          metadata?: Json | null
          page_reference?: string | null
          source_document?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fragment_translations: {
        Row: {
          chunk_id: string
          created_at: string
          model: string
          source_lang: string
          source_sha256: string
          target_lang: string
          translated_text: string
          translation_id: string
          updated_at: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          model: string
          source_lang: string
          source_sha256: string
          target_lang?: string
          translated_text: string
          translation_id?: string
          updated_at?: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          model?: string
          source_lang?: string
          source_sha256?: string
          target_lang?: string
          translated_text?: string
          translation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fragment_translations_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks"
            referencedColumns: ["chunk_id"]
          },
        ]
      }
      judges: {
        Row: {
          created_at: string
          judge_id: string
          name_normalized: string | null
          name_raw: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          judge_id?: string
          name_normalized?: string | null
          name_raw?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          judge_id?: string
          name_normalized?: string | null
          name_raw?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jurisdictions: {
        Row: {
          code: string
          created_at: string
          jurisdiction_id: string
          name_en: string | null
          name_hy: string | null
          name_ru: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          jurisdiction_id?: string
          name_en?: string | null
          name_hy?: string | null
          name_ru?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          jurisdiction_id?: string
          name_en?: string | null
          name_hy?: string | null
          name_ru?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kb_versions: {
        Row: {
          change_reason: string | null
          changed_at: string
          content_text: string | null
          created_at: string
          document_id: string
          id: string
          title: string | null
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          content_text?: string | null
          created_at?: string
          document_id: string
          id?: string
          title?: string | null
          version_number?: number
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          content_text?: string | null
          created_at?: string
          document_id?: string
          id?: string
          title?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          article_number: string | null
          category: Database["public"]["Enums"]["kb_category"] | null
          chunk_id: string | null
          content: string | null
          content_text: string | null
          created_at: string
          document_id: string | null
          id: string
          is_active: boolean
          language: string | null
          metadata: Json
          source_name: string | null
          source_url: string | null
          title: string | null
          updated_at: string
          version_date: string | null
        }
        Insert: {
          article_number?: string | null
          category?: Database["public"]["Enums"]["kb_category"] | null
          chunk_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          metadata?: Json
          source_name?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
          version_date?: string | null
        }
        Update: {
          article_number?: string | null
          category?: Database["public"]["Enums"]["kb_category"] | null
          chunk_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          metadata?: Json
          source_name?: string | null
          source_url?: string | null
          title?: string | null
          updated_at?: string
          version_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks"
            referencedColumns: ["chunk_id"]
          },
          {
            foreignKeyName: "knowledge_base_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      knowledge_document_profiles: {
        Row: {
          classified_at: string | null
          classifier_confidence: number | null
          classifier_method: string | null
          created_at: string
          document_id: string
          has_articles: boolean | null
          has_chapters: boolean | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          classified_at?: string | null
          classifier_confidence?: number | null
          classifier_method?: string | null
          created_at?: string
          document_id: string
          has_articles?: boolean | null
          has_chapters?: boolean | null
          profile_id?: string
          updated_at?: string
        }
        Update: {
          classified_at?: string | null
          classifier_confidence?: number | null
          classifier_method?: string | null
          created_at?: string
          document_id?: string
          has_articles?: boolean | null
          has_chapters?: boolean | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_document_profiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          chunk_id: string | null
          content: string | null
          created_at: string
          document_id: string | null
          id: string
          metadata: Json
          source_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          chunk_id?: string | null
          content?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          chunk_id?: string | null
          content?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json
          source_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks"
            referencedColumns: ["chunk_id"]
          },
          {
            foreignKeyName: "legal_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      legal_edges: {
        Row: {
          confidence: number | null
          created_at: string
          edge_id: string
          edge_type: string
          from_document_id: string
          source: string | null
          to_document_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          edge_id?: string
          edge_type: string
          from_document_id: string
          source?: string | null
          to_document_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          edge_id?: string
          edge_type?: string
          from_document_id?: string
          source?: string | null
          to_document_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_edges_from_document_id_fkey"
            columns: ["from_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "legal_edges_to_document_id_fkey"
            columns: ["to_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      legal_units: {
        Row: {
          created_at: string
          document_id: string
          parent_unit_id: string | null
          sort_order: number | null
          unit_id: string
          unit_number: string | null
          unit_text: string | null
          unit_title: string | null
          unit_type: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          parent_unit_id?: string | null
          sort_order?: number | null
          unit_id?: string
          unit_number?: string | null
          unit_text?: string | null
          unit_title?: string | null
          unit_type?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          parent_unit_id?: string | null
          sort_order?: number | null
          unit_id?: string
          unit_number?: string | null
          unit_text?: string | null
          unit_title?: string | null
          unit_type?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_units_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "legal_units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "legal_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "legal_units_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          notification_type: string
          reminder_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string
          reminder_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          notification_type?: string
          reminder_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_results: {
        Row: {
          confidence: number | null
          created_at: string
          extracted_text: string | null
          file_id: string | null
          id: string
          language: string | null
          needs_review: boolean | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          extracted_text?: string | null
          file_id?: string | null
          id?: string
          language?: string | null
          needs_review?: boolean | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          extracted_text?: string | null
          file_id?: string | null
          id?: string
          language?: string | null
          needs_review?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      parties: {
        Row: {
          created_at: string
          name_raw: string
          party_id: string
          party_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          name_raw: string
          party_id?: string
          party_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          name_raw?: string
          party_id?: string
          party_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      practice_document_profiles: {
        Row: {
          case_number: string | null
          classified_at: string | null
          classifier_confidence: number | null
          classifier_method: string | null
          court_level: string | null
          created_at: string
          document_id: string
          profile_id: string
          updated_at: string
          verdict_type: string | null
        }
        Insert: {
          case_number?: string | null
          classified_at?: string | null
          classifier_confidence?: number | null
          classifier_method?: string | null
          court_level?: string | null
          created_at?: string
          document_id: string
          profile_id?: string
          updated_at?: string
          verdict_type?: string | null
        }
        Update: {
          case_number?: string | null
          classified_at?: string | null
          classifier_confidence?: number | null
          classifier_method?: string | null
          court_level?: string | null
          created_at?: string
          document_id?: string
          profile_id?: string
          updated_at?: string
          verdict_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_document_profiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      practice_to_knowledge_references: {
        Row: {
          created_at: string
          knowledge_doc_id: string | null
          practice_doc_id: string
          ref_id: string
          reference_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          knowledge_doc_id?: string | null
          practice_doc_id: string
          ref_id?: string
          reference_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          knowledge_doc_id?: string | null
          practice_doc_id?: string
          ref_id?: string
          reference_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_to_knowledge_references_knowledge_doc_id_fkey"
            columns: ["knowledge_doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "practice_to_knowledge_references_practice_doc_id_fkey"
            columns: ["practice_doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      profile_compat_settings: {
        Row: {
          created_at: string
          notification_preferences: Json
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notification_preferences?: Json
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notification_preferences?: Json
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_compat_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_compat_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_compat_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      publication_sources: {
        Row: {
          created_at: string
          name: string
          source_id: string
          source_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          name: string
          source_id?: string
          source_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          name?: string
          source_id?: string
          source_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          case_id: string | null
          created_at: string
          description: string | null
          event_datetime: string
          id: string
          notify_before: number[]
          priority: string
          reminder_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          event_datetime: string
          id?: string
          notify_before?: number[]
          priority?: string
          reminder_type?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          description?: string | null
          event_datetime?: string
          id?: string
          notify_before?: number[]
          priority?: string
          reminder_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      search_chunks: {
        Row: {
          article_number: string | null
          char_end: number | null
          char_start: number | null
          chunk_id: string
          chunk_key: string
          chunk_quality_flags: Json
          chunk_text_sha256: string
          chunk_version: string | null
          citation_anchor: string | null
          content_domain: Database["public"]["Enums"]["content_domain"]
          created_at: string
          document_id: string
          effective_from: string | null
          effective_to: string | null
          fts_vector: unknown
          language: string | null
          language_code: string
          legal_status: string | null
          legal_unit_id: string | null
          legal_unit_number: string | null
          legal_unit_type: string | null
          norm_status: Database["public"]["Enums"]["normalized_status"]
          normalized_domain: string | null
          normalized_title: string | null
          page_from: number | null
          page_to: number | null
          paragraph_number: string | null
          parent_legal_unit_id: string | null
          part_number: string | null
          point_number: string | null
          source_date: string | null
          source_document_id: string | null
          source_url: string | null
          text: string
          token_count: number | null
          updated_at: string
          version_id: string
        }
        Insert: {
          article_number?: string | null
          char_end?: number | null
          char_start?: number | null
          chunk_id?: string
          chunk_key: string
          chunk_quality_flags?: Json
          chunk_text_sha256: string
          chunk_version?: string | null
          citation_anchor?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"]
          created_at?: string
          document_id: string
          effective_from?: string | null
          effective_to?: string | null
          fts_vector?: unknown
          language?: string | null
          language_code?: string
          legal_status?: string | null
          legal_unit_id?: string | null
          legal_unit_number?: string | null
          legal_unit_type?: string | null
          norm_status?: Database["public"]["Enums"]["normalized_status"]
          normalized_domain?: string | null
          normalized_title?: string | null
          page_from?: number | null
          page_to?: number | null
          paragraph_number?: string | null
          parent_legal_unit_id?: string | null
          part_number?: string | null
          point_number?: string | null
          source_date?: string | null
          source_document_id?: string | null
          source_url?: string | null
          text: string
          token_count?: number | null
          updated_at?: string
          version_id: string
        }
        Update: {
          article_number?: string | null
          char_end?: number | null
          char_start?: number | null
          chunk_id?: string
          chunk_key?: string
          chunk_quality_flags?: Json
          chunk_text_sha256?: string
          chunk_version?: string | null
          citation_anchor?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"]
          created_at?: string
          document_id?: string
          effective_from?: string | null
          effective_to?: string | null
          fts_vector?: unknown
          language?: string | null
          language_code?: string
          legal_status?: string | null
          legal_unit_id?: string | null
          legal_unit_number?: string | null
          legal_unit_type?: string | null
          norm_status?: Database["public"]["Enums"]["normalized_status"]
          normalized_domain?: string | null
          normalized_title?: string | null
          page_from?: number | null
          page_to?: number | null
          paragraph_number?: string | null
          parent_legal_unit_id?: string | null
          part_number?: string | null
          point_number?: string | null
          source_date?: string | null
          source_document_id?: string | null
          source_url?: string | null
          text?: string
          token_count?: number | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "search_chunks_legal_unit_id_fkey"
            columns: ["legal_unit_id"]
            isOneToOne: false
            referencedRelation: "legal_units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "search_chunks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      search_chunks_legal_unit: {
        Row: {
          article_number: string | null
          char_end: number
          char_start: number
          chunk_id: string
          chunk_key: string
          chunk_quality_flags: Json
          chunk_text_sha256: string
          chunk_version: string
          citation_anchor: string | null
          content_domain: Database["public"]["Enums"]["content_domain"] | null
          created_at: string
          document_id: string
          effective_from: string | null
          effective_to: string | null
          fts_vector: unknown
          language: string | null
          language_code: string | null
          legacy_chunk_id: string | null
          legal_status: string | null
          legal_unit_id: string | null
          legal_unit_number: string | null
          legal_unit_type: string | null
          norm_status: Database["public"]["Enums"]["normalized_status"] | null
          normalized_domain: string | null
          normalized_title: string | null
          page_from: number | null
          page_to: number | null
          paragraph_number: string | null
          parent_legal_unit_id: string | null
          part_number: string | null
          point_number: string | null
          source_date: string | null
          source_document_id: string
          source_url: string | null
          text: string
          token_count: number
          updated_at: string
          version_id: string
        }
        Insert: {
          article_number?: string | null
          char_end: number
          char_start: number
          chunk_id?: string
          chunk_key: string
          chunk_quality_flags?: Json
          chunk_text_sha256: string
          chunk_version?: string
          citation_anchor?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"] | null
          created_at?: string
          document_id: string
          effective_from?: string | null
          effective_to?: string | null
          fts_vector?: unknown
          language?: string | null
          language_code?: string | null
          legacy_chunk_id?: string | null
          legal_status?: string | null
          legal_unit_id?: string | null
          legal_unit_number?: string | null
          legal_unit_type?: string | null
          norm_status?: Database["public"]["Enums"]["normalized_status"] | null
          normalized_domain?: string | null
          normalized_title?: string | null
          page_from?: number | null
          page_to?: number | null
          paragraph_number?: string | null
          parent_legal_unit_id?: string | null
          part_number?: string | null
          point_number?: string | null
          source_date?: string | null
          source_document_id: string
          source_url?: string | null
          text: string
          token_count: number
          updated_at?: string
          version_id: string
        }
        Update: {
          article_number?: string | null
          char_end?: number
          char_start?: number
          chunk_id?: string
          chunk_key?: string
          chunk_quality_flags?: Json
          chunk_text_sha256?: string
          chunk_version?: string
          citation_anchor?: string | null
          content_domain?: Database["public"]["Enums"]["content_domain"] | null
          created_at?: string
          document_id?: string
          effective_from?: string | null
          effective_to?: string | null
          fts_vector?: unknown
          language?: string | null
          language_code?: string | null
          legacy_chunk_id?: string | null
          legal_status?: string | null
          legal_unit_id?: string | null
          legal_unit_number?: string | null
          legal_unit_type?: string | null
          norm_status?: Database["public"]["Enums"]["normalized_status"] | null
          normalized_domain?: string | null
          normalized_title?: string | null
          page_from?: number | null
          page_to?: number | null
          paragraph_number?: string | null
          parent_legal_unit_id?: string | null
          part_number?: string | null
          point_number?: string | null
          source_date?: string | null
          source_document_id?: string
          source_url?: string | null
          text?: string
          token_count?: number
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_chunks_legal_unit_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "search_chunks_legal_unit_legacy_chunk_id_fkey"
            columns: ["legacy_chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks"
            referencedColumns: ["chunk_id"]
          },
          {
            foreignKeyName: "search_chunks_legal_unit_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "search_chunks_legal_unit_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      search_chunks_legal_unit_embeddings: {
        Row: {
          chunk_id: string
          chunk_text_sha256: string
          created_at: string
          dimension: number
          embedding: string | null
          embedding_id: string
          error_message: string | null
          model: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          chunk_id: string
          chunk_text_sha256: string
          created_at?: string
          dimension: number
          embedding?: string | null
          embedding_id?: string
          error_message?: string | null
          model: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          chunk_id?: string
          chunk_text_sha256?: string
          created_at?: string
          dimension?: number
          embedding?: string | null
          embedding_id?: string
          error_message?: string | null
          model?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_chunks_legal_unit_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "search_chunks_legal_unit"
            referencedColumns: ["chunk_id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          leader_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_uploads: {
        Row: {
          caption: string | null
          created_at: string
          file_size: number | null
          file_type: string | null
          filename: string | null
          id: string
          original_filename: string | null
          storage_path: string | null
          telegram_chat_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          id?: string
          original_filename?: string | null
          storage_path?: string | null
          telegram_chat_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          id?: string
          original_filename?: string | null
          storage_path?: string | null
          telegram_chat_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      telegram_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      topics: {
        Row: {
          code: string
          created_at: string
          label_en: string | null
          label_hy: string | null
          label_ru: string | null
          topic_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          label_en?: string | null
          label_hy?: string | null
          label_ru?: string | null
          topic_id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          label_en?: string | null
          label_hy?: string | null
          label_ru?: string | null
          topic_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          analysis_id: string | null
          case_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          case_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          case_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          content_html: string
          content_text: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_html?: string
          content_text?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_html?: string
          content_text?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      version_authorities: {
        Row: {
          authority_id: string
          authority_role: string | null
          created_at: string
          updated_at: string
          version_authority_id: string
          version_id: string
        }
        Insert: {
          authority_id: string
          authority_role?: string | null
          created_at?: string
          updated_at?: string
          version_authority_id?: string
          version_id: string
        }
        Update: {
          authority_id?: string
          authority_role?: string | null
          created_at?: string
          updated_at?: string
          version_authority_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_authorities_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "authorities"
            referencedColumns: ["authority_id"]
          },
          {
            foreignKeyName: "version_authorities_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "document_versions"
            referencedColumns: ["version_id"]
          },
        ]
      }
      cases: {
        Row: {
          appeal_party_role: string | null
          case_number: string | null
          case_type: string | null
          client_id: string | null
          court: string | null
          court_date: string | null
          court_name: string | null
          created_at: string
          current_stage: string | null
          deleted_at: string | null
          description: string | null
          facts: string | null
          id: string
          lawyer_id: string
          legal_question: string | null
          notes: string | null
          party_role: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          appeal_party_role?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_date?: string | null
          court_name?: string | null
          created_at?: string
          current_stage?: string | null
          deleted_at?: string | null
          description?: string | null
          facts?: string | null
          id?: string
          lawyer_id?: string
          legal_question?: string | null
          notes?: string | null
          party_role?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          appeal_party_role?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_date?: string | null
          court_name?: string | null
          created_at?: string
          current_stage?: string | null
          deleted_at?: string | null
          description?: string | null
          facts?: string | null
          id?: string
          lawyer_id?: string
          legal_question?: string | null
          notes?: string | null
          party_role?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      case_files: {
        Row: {
          case_id: string
          created_at: string
          deleted_at: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          notes: string | null
          original_filename: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          notes?: string | null
          original_filename?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          notes?: string | null
          original_filename?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auditor_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_migrated: boolean
          id: string
          is_active: boolean
          last_login_at: string
          notification_preferences: Json | null
          preferences: Json | null
          role: string
          telegram_chat_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          auditor_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_migrated?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string
          notification_preferences?: Json | null
          preferences?: Json | null
          role?: string
          telegram_chat_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          auditor_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_migrated?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string
          notification_preferences?: Json | null
          preferences?: Json | null
          role?: string
          telegram_chat_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role?: string
          user_id?: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_analysis: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          prompt_used: string | null
          response_text: string | null
          role: string | null
          sources_used: Json
        }
        Insert: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_used?: string | null
          response_text?: string | null
          role?: string | null
          sources_used?: Json
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_used?: string | null
          response_text?: string | null
          role?: string | null
          sources_used?: Json
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          case_id: string | null
          content: string | null
          content_text: string | null
          created_at: string
          document_type: string | null
          id: string
          metadata: Json | null
          recipient_name: string | null
          recipient_organization: string | null
          recipient_position: string | null
          sender_address: string | null
          sender_contact: string | null
          sender_name: string | null
          source_text: string | null
          status: string
          template_id: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_organization?: string | null
          recipient_position?: string | null
          sender_address?: string | null
          sender_contact?: string | null
          sender_name?: string | null
          source_text?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_organization?: string | null
          recipient_position?: string | null
          sender_address?: string | null
          sender_contact?: string | null
          sender_name?: string | null
          source_text?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      case_members: {
        Row: {
          case_id: string
          case_role: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          case_role?: string | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          case_role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_analysis: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          prompt_used: string | null
          response_text: string | null
          role: string | null
          sources_used: Json
        }
        Insert: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_used?: string | null
          response_text?: string | null
          role?: string | null
          sources_used?: Json
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_used?: string | null
          response_text?: string | null
          role?: string | null
          sources_used?: Json
        }
        Relationships: []
      }
      case_files: {
        Row: {
          case_id: string
          created_at: string
          deleted_at: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          notes: string | null
          original_filename: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          notes?: string | null
          original_filename?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          notes?: string | null
          original_filename?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: []
      }
      case_members: {
        Row: {
          case_id: string
          case_role: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          case_role?: string | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          case_role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cases: {
        Row: {
          appeal_party_role: string | null
          case_number: string | null
          case_type: string | null
          client_id: string | null
          court: string | null
          court_date: string | null
          court_name: string | null
          created_at: string
          current_stage: string | null
          deleted_at: string | null
          description: string | null
          facts: string | null
          id: string
          lawyer_id: string
          legal_question: string | null
          notes: string | null
          party_role: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          appeal_party_role?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_date?: string | null
          court_name?: string | null
          created_at?: string
          current_stage?: string | null
          deleted_at?: string | null
          description?: string | null
          facts?: string | null
          id?: string
          lawyer_id?: string
          legal_question?: string | null
          notes?: string | null
          party_role?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          appeal_party_role?: string | null
          case_number?: string | null
          case_type?: string | null
          client_id?: string | null
          court?: string | null
          court_date?: string | null
          court_name?: string | null
          created_at?: string
          current_stage?: string | null
          deleted_at?: string | null
          description?: string | null
          facts?: string | null
          id?: string
          lawyer_id?: string
          legal_question?: string | null
          notes?: string | null
          party_role?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          case_id: string | null
          content: string | null
          content_text: string | null
          created_at: string
          document_type: string | null
          id: string
          metadata: Json | null
          recipient_name: string | null
          recipient_organization: string | null
          recipient_position: string | null
          sender_address: string | null
          sender_contact: string | null
          sender_name: string | null
          source_text: string | null
          status: string
          template_id: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_organization?: string | null
          recipient_position?: string | null
          sender_address?: string | null
          sender_contact?: string | null
          sender_name?: string | null
          source_text?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          content?: string | null
          content_text?: string | null
          created_at?: string
          document_type?: string | null
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          recipient_organization?: string | null
          recipient_position?: string | null
          sender_address?: string | null
          sender_contact?: string | null
          sender_name?: string | null
          source_text?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auditor_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          has_migrated: boolean
          id: string
          is_active: boolean
          last_login_at: string
          notification_preferences: Json | null
          preferences: Json | null
          role: string
          telegram_chat_id: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          auditor_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_migrated?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string
          notification_preferences?: Json | null
          preferences?: Json | null
          role?: string
          telegram_chat_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          auditor_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          has_migrated?: boolean
          id?: string
          is_active?: boolean
          last_login_at?: string
          notification_preferences?: Json | null
          preferences?: Json | null
          role?: string
          telegram_chat_id?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role?: string
          user_id?: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Functions: {
      admin_set_user_role: {
        Args: { p_role: "admin" | "lawyer" | "client"; p_user_id: string }
        Returns: undefined
      }
      case_files_object_case_id: {
        Args: { object_name: string }
        Returns: string
      }
      get_ai_metrics_summary: {
        Args: { p_days?: number }
        Returns: {
          avg_latency_ms: number
          calls: number
          cost_usd: number
          day: string
          failures: number
          fn_name: string
          model: string
          total_tokens: number
        }[]
      }
      get_embedding_metrics: {
        Args: { p_model?: string }
        Returns: {
          embedded: number
          est_remaining_cost_usd: number
          est_total_cost_usd: number
          est_total_tokens: number
          failed: number
          model: string
          pending: number
          total_chunks: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      lookup_by_article: {
        Args: {
          p_article_number?: string
          p_document_ref?: string
          p_limit?: number
        }
        Returns: {
          arlis_doc_id: string
          canonical_key: string
          chunk_id: string
          citation_anchor: string
          doc_number_clean: string
          document_id: string
          effective_from: string
          effective_to: string
          legal_unit_id: string
          match_type: string
          page_from: number
          page_to: number
          rank_score: number
          source_url: string
          text: string
          title_hy: string
          title_ru: string
          unit_number: string
          unit_title: string
          unit_type: string
          version_id: string
        }[]
      }
      lookup_by_citation: {
        Args: { p_citation?: string; p_limit?: number }
        Returns: {
          arlis_doc_id: string
          canonical_key: string
          chunk_id: string
          citation_anchor: string
          doc_number_clean: string
          document_id: string
          effective_from: string
          effective_to: string
          legal_unit_id: string
          match_type: string
          page_from: number
          page_to: number
          rank_score: number
          source_url: string
          text: string
          title_hy: string
          title_ru: string
          unit_number: string
          unit_title: string
          unit_type: string
          version_id: string
        }[]
      }
      lookup_table_rows: {
        Args: {
          p_document_ref?: string
          p_limit?: number
          p_table_ref?: string
        }
        Returns: {
          arlis_doc_id: string
          canonical_key: string
          chunk_id: string
          citation_anchor: string
          doc_number_clean: string
          document_id: string
          effective_from: string
          effective_to: string
          legal_unit_id: string
          match_type: string
          page_from: number
          page_to: number
          rank_score: number
          source_url: string
          text: string
          title_hy: string
          title_ru: string
          unit_number: string
          unit_title: string
          unit_type: string
          version_id: string
        }[]
      }
      record_ai_analysis_run: {
        Args: {
          p_case_id: string
          p_model: string
          p_query: string
          p_result: Json
        }
        Returns: {
          case_id: string
          run_id: string
        }[]
      }
      record_ai_metric: {
        Args: {
          p_case_id?: string
          p_cost_usd?: number
          p_error_message?: string
          p_fn_name: string
          p_input_tokens?: number
          p_latency_ms?: number
          p_model?: string
          p_output_tokens?: number
          p_status?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      search_legal_corpus: {
        Args: {
          p_content_domain?: Database["public"]["Enums"]["content_domain"]
          p_effective_at?: string
          p_language_code?: string
          p_limit?: number
          p_norm_status?: Database["public"]["Enums"]["normalized_status"]
          p_offset?: number
          p_query_embedding: string
          p_query_text: string
        }
        Returns: {
          chunk_id: string
          citation_anchor: string
          content_domain: Database["public"]["Enums"]["content_domain"]
          document_id: string
          effective_from: string
          effective_to: string
          fts_score: number
          hybrid_score: number
          match_reason: string
          norm_status: Database["public"]["Enums"]["normalized_status"]
          page_from: number
          page_to: number
          source_url: string
          text_snippet: string
          title_hy: string
          vector_score: number
          version_id: string
        }[]
      }
      search_legal_corpus_dual: {
        Args: {
          p_bm25_limit?: number
          p_content_domain?: Database["public"]["Enums"]["content_domain"]
          p_effective_at?: string
          p_limit?: number
          p_metric_embedding?: string
          p_metric_limit?: number
          p_norm_status?: Database["public"]["Enums"]["normalized_status"]
          p_query_text: string
          p_qwen_embedding?: string
          p_qwen_limit?: number
        }
        Returns: {
          chunk_id: string
          citation_anchor: string
          content_domain: Database["public"]["Enums"]["content_domain"]
          doc_id: string
          document_id: string
          fts_score: number
          language: string
          match_reason: string
          norm_status: Database["public"]["Enums"]["normalized_status"]
          retrieval_model: string
          retrieval_route: string
          score: number
          source: string
          source_url: string
          text_snippet: string
          title: string
          vector_score: number
          version_id: string
        }[]
      }
      search_legal_unit_chunks_preview: {
        Args: {
          p_content_domain?: Database["public"]["Enums"]["content_domain"]
          p_effective_at?: string
          p_language?: string
          p_limit?: number
          p_query_text: string
        }
        Returns: {
          article_number: string
          chunk_id: string
          chunk_version: string
          citation_anchor: string
          content_domain: Database["public"]["Enums"]["content_domain"]
          document_id: string
          language: string
          legal_unit_id: string
          norm_status: Database["public"]["Enums"]["normalized_status"]
          score: number
          source_url: string
          text_snippet: string
          title: string
          version_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_roles_guard: { Args: never; Returns: boolean }
    }
    Enums: {
      case_status: "open" | "in_progress" | "pending" | "closed" | "archived"
      case_priority: "low" | "medium" | "high" | "urgent"
      content_domain: "knowledge_base" | "practice" | "unknown"
      kb_category:
        | "constitution"
        | "civil_code"
        | "civil_procedure_code"
        | "criminal_code"
        | "criminal_procedure_code"
        | "administrative_procedure_code"
        | "administrative_violations_code"
        | "judicial_code"
        | "labor_code"
        | "tax_code"
        | "family_code"
        | "land_code"
        | "water_code"
        | "forest_code"
        | "subsoil_code"
        | "electoral_code"
        | "penal_enforcement_code"
        | "eaeu_customs_code"
        | "echr"
        | "cassation_criminal"
        | "cassation_civil"
        | "cassation_administrative"
        | "constitutional_court_decisions"
        | "echr_judgments"
        | "government_decisions"
        | "central_electoral_commission_decisions"
        | "prime_minister_decisions"
        | "arlis_am"
        | "datalex_am"
        | "ministry_of_health"
        | "statistics_registry_decisions"
        | "other"
        | "administrative_code"
        | "court_practice"
        | "legal_commentary"
        | "urban_planning_code"
        | "state_duty_law"
        | "citizenship_law"
        | "public_service_law"
        | "human_rights_law"
        | "anti_corruption_body_law"
        | "corruption_prevention_law"
        | "mass_media_law"
        | "education_law"
        | "healthcare_law"
      normalized_status:
        | "active"
        | "repealed"
        | "partially_active"
        | "draft"
        | "unknown"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_domain: ["knowledge_base", "practice", "unknown"],
      kb_category: [
        "constitution",
        "civil_code",
        "civil_procedure_code",
        "criminal_code",
        "criminal_procedure_code",
        "administrative_procedure_code",
        "administrative_violations_code",
        "judicial_code",
        "labor_code",
        "tax_code",
        "family_code",
        "land_code",
        "water_code",
        "forest_code",
        "subsoil_code",
        "electoral_code",
        "penal_enforcement_code",
        "eaeu_customs_code",
        "echr",
        "cassation_criminal",
        "cassation_civil",
        "cassation_administrative",
        "constitutional_court_decisions",
        "echr_judgments",
        "government_decisions",
        "central_electoral_commission_decisions",
        "prime_minister_decisions",
        "arlis_am",
        "datalex_am",
        "ministry_of_health",
        "statistics_registry_decisions",
        "other",
        "administrative_code",
        "court_practice",
        "legal_commentary",
        "urban_planning_code",
        "state_duty_law",
        "citizenship_law",
        "public_service_law",
        "human_rights_law",
        "anti_corruption_body_law",
        "corruption_prevention_law",
        "mass_media_law",
        "education_law",
        "healthcare_law",
      ],
      normalized_status: [
        "active",
        "repealed",
        "partially_active",
        "draft",
        "unknown",
      ],
    },
  },
} as const
