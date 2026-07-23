import { formatDistance } from 'date-fns';

interface TimelineEvent {
  id: string;
  date: Date;
  title: string;
  description?: string;
  type: 'milestone' | 'deadline' | 'hearing' | 'filing' | 'notification';
  status: 'completed' | 'upcoming' | 'overdue';
}

interface LegalTimelineProps {
  events: TimelineEvent[];
  title?: string;
}

const typeConfig = {
  milestone: { color: 'bg-blue-500', label: 'Milestone' },
  deadline: { color: 'bg-red-500', label: 'Deadline' },
  hearing: { color: 'bg-purple-500', label: 'Hearing' },
  filing: { color: 'bg-green-500', label: 'Filing' },
  notification: { color: 'bg-amber-500', label: 'Notification' },
};

const statusConfig = {
  completed: { textColor: 'text-slate-600', lineColor: 'border-slate-300' },
  upcoming: { textColor: 'text-slate-800', lineColor: 'border-blue-400' },
  overdue: { textColor: 'text-red-600', lineColor: 'border-red-400' },
};

export function LegalTimeline({ events, title }: LegalTimelineProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      {title && (
        <h3 className="mb-6 font-serif text-lg font-semibold text-slate-900">
          {title}
        </h3>
      )}

      <div className="space-y-6">
        {events.map((event, index) => {
          const typeInfo = typeConfig[event.type];
          const statusInfo = statusConfig[event.status];
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="relative flex gap-4">
              {/* Timeline line */}
              {!isLast && (
                <div className={`absolute left-[22px] top-12 h-8 border-l-2 ${statusInfo.lineColor}`} />
              )}

              {/* Timeline dot */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`h-12 w-12 rounded-full border-4 border-white ${typeInfo.color} flex items-center justify-center`}
                  style={{
                    boxShadow: '0 0 0 2px white, 0 0 0 4px #e2e8f0',
                  }}
                >
                  <span className="text-xs font-bold text-white">
                    {event.type === 'deadline' ? '!' : event.type === 'hearing' ? '⚖️' : '✓'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 pt-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`font-serif font-semibold ${statusInfo.textColor}`}>
                      {event.title}
                    </h4>
                    {event.description && (
                      <p className="mt-1 text-sm text-slate-600">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 text-right text-xs font-medium text-slate-500">
                    {event.status === 'overdue' && (
                      <span className="text-red-600 font-semibold">Overdue</span>
                    )}
                    {event.status === 'completed' && (
                      <span className="text-green-600">
                        {formatDistance(event.date, new Date(), { addSuffix: true })}
                      </span>
                    )}
                    {event.status === 'upcoming' && (
                      <span className="text-blue-600">
                        In {formatDistance(event.date, new Date())}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
