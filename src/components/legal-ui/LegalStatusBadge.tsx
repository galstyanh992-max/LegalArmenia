import { CheckCircle, AlertCircle, Clock, XCircle, Info } from 'lucide-react';

interface LegalStatusBadgeProps {
  status: 'approved' | 'pending' | 'rejected' | 'urgent' | 'info';
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  approved: {
    icon: CheckCircle,
    colors: 'bg-green-50 border-green-200 text-green-700',
    bgGradient: 'from-green-50 to-green-100/50',
  },
  pending: {
    icon: Clock,
    colors: 'bg-amber-50 border-amber-200 text-amber-700',
    bgGradient: 'from-amber-50 to-amber-100/50',
  },
  rejected: {
    icon: XCircle,
    colors: 'bg-red-50 border-red-200 text-red-700',
    bgGradient: 'from-red-50 to-red-100/50',
  },
  urgent: {
    icon: AlertCircle,
    colors: 'bg-red-50 border-red-200 text-red-700',
    bgGradient: 'from-red-50 to-red-100/50',
  },
  info: {
    icon: Info,
    colors: 'bg-blue-50 border-blue-200 text-blue-700',
    bgGradient: 'from-blue-50 to-blue-100/50',
  },
};

const sizeConfig = {
  sm: { iconClass: 'h-3.5 w-3.5', textClass: 'text-xs px-2 py-1' },
  md: { iconClass: 'h-4 w-4', textClass: 'text-sm px-3 py-1.5' },
  lg: { iconClass: 'h-5 w-5', textClass: 'text-base px-4 py-2' },
};

export function LegalStatusBadge({
  status,
  label,
  size = 'md',
}: LegalStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeConfig_ = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border ${config.colors} ${sizeConfig_.textClass} font-medium`}>
      <Icon className={sizeConfig_.iconClass} />
      <span>{label}</span>
    </div>
  );
}
