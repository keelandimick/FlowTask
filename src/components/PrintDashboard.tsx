import React, { useEffect } from 'react';
import { Item, Priority } from '../types';
import { format } from 'date-fns';
import { formatRecurrence } from '../lib/formatRecurrence';

interface PrintDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  nowPriorityTasks: Item[];
  upcomingReminders: Item[];
  recurringItems: Item[];
}

const priorityColors: Record<Priority, string> = {
  now: '#dc2626',
  high: '#f97316',
  low: '#16a34a',
};

const priorityLabels: Record<Priority, string> = {
  now: 'Now',
  high: 'High',
  low: 'Low',
};

export const PrintDashboard: React.FC<PrintDashboardProps> = ({
  isOpen,
  onClose,
  nowPriorityTasks,
  upcomingReminders,
  recurringItems,
}) => {
  // Inject print styles and trigger print when modal opens
  useEffect(() => {
    if (isOpen) {
      // Create style element to hide everything except print content
      const style = document.createElement('style');
      style.id = 'print-dashboard-styles';
      style.textContent = `
        @media print {
          /* Hide everything */
          body * {
            visibility: hidden;
          }
          /* Show only print dashboard and its children */
          #print-dashboard-root,
          #print-dashboard-root * {
            visibility: visible;
          }
          #print-dashboard-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #print-dashboard-content {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);

      // Trigger print after a short delay
      const timer = setTimeout(() => {
        window.print();
      }, 150);

      return () => {
        clearTimeout(timer);
        const existingStyle = document.getElementById('print-dashboard-styles');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderItem = (item: Item) => {
    const hasOnHold = !!item.metadata?.onHold;

    return (
      <div
        key={item.id}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          padding: '6px 0',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            border: '1.5px solid #9ca3af',
            borderRadius: '3px',
            flexShrink: 0,
            marginRight: '10px',
            marginTop: '2px',
          }}
        />
        <div style={{ flex: 1, paddingRight: '16px' }}>
          <span style={{ fontSize: '14px', color: '#1f2937' }}>{item.title}</span>
          {hasOnHold && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#dc2626',
                backgroundColor: '#fee2e2',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              ON HOLD
            </span>
          )}
          {/* Date for reminders */}
          {item.type === 'reminder' && item.reminderDate && !item.recurrence && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {format(new Date(item.reminderDate), 'MMM d, h:mm a')}
            </div>
          )}
          {/* Recurrence info */}
          {item.recurrence && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
              {formatRecurrence(item.recurrence)}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: '600',
            color: 'white',
            backgroundColor: priorityColors[item.priority],
            padding: '3px 10px',
            borderRadius: '12px',
            flexShrink: 0,
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          } as React.CSSProperties}
        >
          {priorityLabels[item.priority]}
        </span>
      </div>
    );
  };

  return (
    <div
      id="print-dashboard-root"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      <div
        id="print-dashboard-content"
        style={{
          width: '100%',
          maxWidth: '800px',
          margin: '0 auto',
          padding: '32px',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="no-print"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: '#6b7280',
          }}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* NOW Priority Tasks */}
        {nowPriorityTasks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >
              ⚡️ Now Priority ({nowPriorityTasks.length})
            </h2>
            <div>{nowPriorityTasks.map(renderItem)}</div>
          </div>
        )}

        {/* Today & Upcoming */}
        {upcomingReminders.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >
              📅 Today & Upcoming ({upcomingReminders.length})
            </h2>
            <div>{upcomingReminders.map(renderItem)}</div>
          </div>
        )}

        {/* Recurring */}
        {recurringItems.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >
              🔄 Recurring ({recurringItems.length})
            </h2>
            <div>{recurringItems.map(renderItem)}</div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: 'right',
            fontSize: '11px',
            color: '#9ca3af',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          Printed from FlowTask {format(new Date(), 'MMM d, yyyy \'at\' h:mm a')}
        </div>
      </div>
    </div>
  );
};
