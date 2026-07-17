import { ReactNode } from 'react';
import { AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';

interface LegalInfoCardProps {
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  description?: string | ReactNode;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const typeConfig = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    title: 'text-blue-900',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-600',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'text-amber-900',
    text: 'text-amber-800',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    title: 'text-green-900',
    text: 'text-green-800',
    icon: CheckCircle,
    iconColor: 'text-green-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'text-red-900',
    text: 'text-red-800',
    icon: XCircle,
    iconColor: 'text-red-600',
  },
};

export function LegalInfoCard({
  type,
  title,
  description,
  icon,
  action,
}: LegalInfoCardProps) {
  const config = typeConfig[type];
  const DefaultIcon = config.icon;

  return (
    <div className={`rounded-lg border-2 ${config.border} ${config.bg} p-5`}>
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {icon || <DefaultIcon className={`h-5 w-5 ${config.iconColor}`} />}
        </div>
        <div className="flex-1">
          <h3 className={`font-serif font-semibold ${config.title}`}>
            {title}
          </h3>
          {description && (
            <div className={`mt-1 text-sm ${config.text}`}>
              {description}
            </div>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className={`mt-3 inline-flex font-medium underline hover:no-underline ${config.title} transition-colors`}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
