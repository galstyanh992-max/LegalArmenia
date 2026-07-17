import { format } from 'date-fns';
import { Scale, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LegalCaseCardProps {
  id: string;
  title: string;
  caseNumber: string;
  court?: string;
  status: 'open' | 'closed' | 'pending' | 'appeal';
  priority?: 'high' | 'medium' | 'low';
  deadlineDate?: Date;
  lastUpdated: Date;
  description?: string;
}

const statusConfig = {
  open: { label: 'Active', color: 'bg-green-50 text-green-800 border-green-200' },
  closed: { label: 'Closed', color: 'bg-slate-50 text-slate-800 border-slate-200' },
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  appeal: { label: 'Under Appeal', color: 'bg-blue-50 text-blue-800 border-blue-200' },
};

const priorityConfig = {
  high: { label: 'High Priority', icon: AlertCircle, color: 'text-red-600' },
  medium: { label: 'Medium', icon: null, color: 'text-amber-600' },
  low: { label: 'Low', icon: null, color: 'text-slate-600' },
};

export function LegalCaseCard({
  id,
  title,
  caseNumber,
  court,
  status,
  priority,
  deadlineDate,
  lastUpdated,
  description,
}: LegalCaseCardProps) {
  const statusConfig_ = statusConfig[status];
  const priorityConfig_ = priority ? priorityConfig[priority] : null;
  const PriorityIcon = priorityConfig_?.icon;

  return (
    <div className="group relative overflow-hidden rounded-lg border-2 border-slate-200 bg-white transition-all duration-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50">
      {/* Header Section */}
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 flex-shrink-0 text-blue-700" />
              <span className="font-serif text-xs font-semibold uppercase tracking-wider text-slate-600">
                Case #{caseNumber}
              </span>
            </div>
            <h3 className="font-serif text-lg font-semibold leading-snug text-slate-900 line-clamp-2">
              {title}
            </h3>
            {court && (
              <p className="text-sm text-slate-600">{court}</p>
            )}
          </div>
          <Badge className={statusConfig_.color}>
            {statusConfig_.label}
          </Badge>
        </div>
      </div>

      {/* Content Section */}
      {description && (
        <div className="px-5 py-3">
          <p className="text-sm text-slate-600 line-clamp-2">
            {description}
          </p>
        </div>
      )}

      {/* Footer Section */}
      <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            {deadlineDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{format(deadlineDate, 'MMM d, yyyy')}</span>
              </div>
            )}
            {priority && (
              <div className={`flex items-center gap-1.5 font-medium ${priorityConfig_.color}`}>
                {PriorityIcon && <PriorityIcon className="h-4 w-4" />}
                <span>{priorityConfig_.label}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Updated {format(lastUpdated, 'MMM d')}
          </div>
        </div>
      </div>

      {/* Hover Indicator */}
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-blue-50/0 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  );
}
