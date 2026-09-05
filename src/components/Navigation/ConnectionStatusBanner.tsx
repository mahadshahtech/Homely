import React, { useState } from 'react';
import { WifiOff, RefreshCw, AlertCircle, CheckCircle2, CloudOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useSync } from '../../context/SyncContext';

export const ConnectionStatusBanner: React.FC = () => {
  const {
    connectionState,
    syncStatus,
    isOffline,
    pendingCount,
    failedCount,
    pendingActions,
    syncNow,
    retryFailed
  } = useSync();

  const [expanded, setExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // If online and fully synced, do not render any obtrusive banner
  if (connectionState === 'online' && syncStatus === 'synced') {
    return null;
  }

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      if (failedCount > 0) {
        await retryFailed();
      } else {
        await syncNow();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <aside
      aria-label="Connection and sync status"
      className="w-full z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 shadow-xs transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {isOffline ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <WifiOff className="h-3.5 w-3.5" />
              </span>
            ) : syncStatus === 'syncing' || connectionState === 'reconnecting' ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              </span>
            ) : failedCount > 0 ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            )}

            <div className="truncate">
              {isOffline ? (
                <span className="font-medium text-amber-900 dark:text-amber-200">
                  Offline Mode &bull; Viewing saved family moments
                  {pendingCount > 0 && (
                    <span className="font-normal text-amber-700 dark:text-amber-400 ml-1.5">
                      ({pendingCount} changes waiting to sync)
                    </span>
                  )}
                </span>
              ) : connectionState === 'reconnecting' ? (
                <span className="font-medium text-stone-700 dark:text-stone-300">
                  Reconnecting to family space...
                </span>
              ) : syncStatus === 'syncing' ? (
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  Syncing family updates...
                </span>
              ) : failedCount > 0 ? (
                <span className="font-medium text-rose-800 dark:text-rose-300">
                  {failedCount} item{failedCount > 1 ? 's' : ''} couldn't sync automatically
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {failedCount > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying || isOffline}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-700 active:scale-95 text-white disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry
              </button>
            )}

            {!isOffline && pendingCount > 0 && syncStatus !== 'syncing' && failedCount === 0 && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
            )}

            {pendingActions.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-1 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors cursor-pointer"
                title={expanded ? 'Hide sync details' : 'Show sync details'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable details of pending queue */}
        {expanded && pendingActions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-stone-200 dark:border-stone-800 max-h-48 overflow-y-auto space-y-1.5 text-xs">
            <p className="font-semibold text-stone-600 dark:text-stone-400">
              Offline Sync Queue ({pendingActions.length} items)
            </p>
            {pendingActions.map((action) => {
              const label =
                action.actionType === 'send_message'
                  ? 'Chat message'
                  : action.actionType === 'create_post'
                  ? 'Family post'
                  : action.actionType === 'add_comment'
                  ? 'Post comment'
                  : action.actionType === 'toggle_reaction'
                  ? 'Post reaction'
                  : action.actionType === 'create_event'
                  ? 'Calendar event'
                  : 'Update event';

              return (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CloudOff className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                    <span className="font-medium truncate">{label}</span>
                    {action.errorMessage && (
                      <span className="text-rose-600 dark:text-rose-400 truncate max-w-xs">
                        &bull; {action.errorMessage}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0 ${
                      action.status === 'failed'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                        : action.status === 'syncing'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {action.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
