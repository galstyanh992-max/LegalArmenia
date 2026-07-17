import { format } from 'date-fns';
import { FileText, Download, Eye, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LegalDocumentCardProps {
  id: string;
  title: string;
  documentType: 'complaint' | 'petition' | 'brief' | 'motion' | 'contract' | 'agreement';
  status: 'draft' | 'submitted' | 'filed' | 'approved';
  caseNumber?: string;
  createdDate: Date;
  updatedDate: Date;
  confidential?: boolean;
  pageCount?: number;
  onView?: () => void;
  onDownload?: () => void;
}

const documentTypeConfig = {
  complaint: { label: 'Complaint', color: 'bg-red-50 text-red-700 border-red-200' },
  petition: { label: 'Petition', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  brief: { label: 'Brief', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  motion: { label: 'Motion', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  contract: { label: 'Contract', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  agreement: { label: 'Agreement', color: 'bg-green-50 text-green-700 border-green-200' },
};

const statusConfig = {
  draft: { label: 'Draft', icon: '✏️', color: 'text-slate-600' },
  submitted: { label: 'Submitted', icon: '📤', color: 'text-blue-600' },
  filed: { label: 'Filed', icon: '✓', color: 'text-green-600' },
  approved: { label: 'Approved', icon: '✓✓', color: 'text-green-700 font-semibold' },
};

export function LegalDocumentCard({
  id,
  title,
  documentType,
  status,
  caseNumber,
  createdDate,
  updatedDate,
  confidential,
  pageCount,
  onView,
  onDownload,
}: LegalDocumentCardProps) {
  const docTypeConfig = documentTypeConfig[documentType];
  const statusConfig_ = statusConfig[status];

  return (
    <div className="group relative overflow-hidden rounded-lg border-2 border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50">
      {/* Header */}
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-slate-600" />
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg font-semibold leading-snug text-slate-900 line-clamp-2">
                {title}
              </h3>
              {caseNumber && (
                <p className="mt-1 text-xs text-slate-600">Case #{caseNumber}</p>
              )}
            </div>
          </div>
          {confidential && (
            <Lock className="h-5 w-5 flex-shrink-0 text-amber-600" />
          )}
        </div>
      </div>

      {/* Badges and Metadata */}
      <div className="border-b border-slate-200 px-5 py-3">
        <div className="flex flex-wrap gap-2">
          <Badge className={docTypeConfig.color}>
            {docTypeConfig.label}
          </Badge>
          <Badge className="bg-slate-100 text-slate-700 border-slate-300">
            {statusConfig_.label}
          </Badge>
          {pageCount && (
            <Badge variant="outline">
              {pageCount} page{pageCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Footer with timestamps and actions */}
      <div className="bg-slate-50/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1 text-xs text-slate-600">
            <span>Created: {format(createdDate, 'MMM d, yyyy')}</span>
            {updatedDate && createdDate.getTime() !== updatedDate.getTime() && (
              <span>Updated: {format(updatedDate, 'MMM d, yyyy')}</span>
            )}
          </div>
          <div className="flex gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onView}
                className="hover:bg-blue-50 hover:text-blue-700"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                className="hover:bg-slate-200"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hover effect */}
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-blue-50/0 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  );
}
