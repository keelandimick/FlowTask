import React, { useState, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { Priority, RecurrenceFrequency, ViewMode, Item } from '../types';
import { format } from 'date-fns';
import customChrono from '../lib/chronoConfig';
import { processTextWithAI } from '../lib/ai';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  editItem?: Item | null;
  defaultColumn?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, mode, editItem, defaultColumn }) => {
  const {
    addItem,
    items,
    currentListId,
    currentView,
    setCurrentView,
    setHighlightedItem,
    lists,
    setCurrentList
  } = useStoreWithAuth();

  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Allow Enter from any field except textarea elements
        if (!(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, title, defaultColumn, currentListId, currentView]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    // Check for duplicates (case insensitive) in active items only
    const normalizedTitle = title.trim().toLowerCase();
    const duplicateExists = items.some(item => 
      !item.deletedAt && 
      item.status !== 'complete' &&
      item.title.toLowerCase() === normalizedTitle &&
      (mode === 'create' || item.id !== editItem?.id) // Don't check against self when editing
    );
    
    if (duplicateExists) {
      alert('A task with this title already exists');
      return;
    }
    
    setIsProcessing(true);

    // Extract date and recurring patterns from title automatically
    let extractedTitle = title.trim();
    let extractedDate: Date | undefined;
    let detectedRecurrence: { frequency: RecurrenceFrequency; time: string; originalText?: string } | undefined;

    // Check for recurring patterns first
    const recurringPatterns = [
      { pattern: /\b(every\s+day|daily)\b/i, frequency: 'daily' as RecurrenceFrequency },
      { pattern: /\b(every\s+week|weekly)\b/i, frequency: 'weekly' as RecurrenceFrequency },
      { pattern: /\b(every\s+month|monthly)\b/i, frequency: 'monthly' as RecurrenceFrequency },
      { pattern: /\b(every\s+year|yearly|annually)\b/i, frequency: 'yearly' as RecurrenceFrequency },
      { pattern: /\bevery\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i, frequency: 'weekly' as RecurrenceFrequency },
      // Additional patterns - best effort basis
      { pattern: /\bevery\s+\d+\s+hours?\b/i, frequency: 'daily' as RecurrenceFrequency }, // "every 3 hours" -> daily
      { pattern: /\bevery\s+(other|2nd|second)\s+(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/i, frequency: 'weekly' as RecurrenceFrequency }, // "every other tuesday" -> weekly
      { pattern: /\b(weekdays|every\s+weekday)\b/i, frequency: 'daily' as RecurrenceFrequency }, // "weekdays" -> daily
      { pattern: /\b(weekends|every\s+weekend)\b/i, frequency: 'weekly' as RecurrenceFrequency } // "weekends" -> weekly
    ];

    for (const { pattern, frequency } of recurringPatterns) {
      const match = title.match(pattern);
      if (match) {
        detectedRecurrence = {
          frequency,
          time: '09:00',
          originalText: match[0] // Store the original pattern text
        };
        extractedTitle = title.replace(match[0], '').trim();
        // Re-capitalize if needed after removing recurring pattern
        if (extractedTitle.length > 0) {
          extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
        }

        // Try to parse time from the title
        const timeMatch = title.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)?\b/i);
        if (timeMatch && timeMatch[2] && detectedRecurrence) {
          let hours = parseInt(timeMatch[2], 10);
          const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0;

          if (timeMatch[4]) {
            const isPM = timeMatch[4].toLowerCase() === 'pm';
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
          } else if (hours >= 1 && hours <= 11) {
            hours += 12; // Default to PM for common reminder times
          }

          detectedRecurrence.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          // Strip the time from the title (like reminders do)
          extractedTitle = extractedTitle.replace(timeMatch[0], '').trim();
          if (extractedTitle.length > 0) {
            extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
          }
        }
        break;
      }
    }

    // If no recurring pattern found, try to extract a single date
    if (!detectedRecurrence) {
      const parsedFromTitle = customChrono.parse(title.trim());
      if (parsedFromTitle.length > 0) {
        extractedDate = parsedFromTitle[0].start.date();
        // Remove the date text from the title
        extractedTitle = title.replace(parsedFromTitle[0].text, '').trim();
        // Re-capitalize if needed after removing date text
        if (extractedTitle.length > 0) {
          extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
        }
      }
    }

    // Now process the cleaned title with AI for spell correction, list matching, and priority detection
    let aiSuggestedListId: string | undefined;
    let aiSuggestedPriority: Priority = 'low';
    try {
      const processed = await processTextWithAI(extractedTitle, lists.map(l => ({ id: l.id, name: l.name })));
      extractedTitle = processed.correctedText;
      aiSuggestedListId = processed.suggestedListId;
      aiSuggestedPriority = processed.suggestedPriority || 'low';
    } catch (error) {
      console.error('AI processing failed, using original text:', error);
      // Fallback: just capitalize first letter
      if (extractedTitle.length > 0) {
        extractedTitle = extractedTitle.charAt(0).toUpperCase() + extractedTitle.slice(1);
      }
    }

    const hasDate = extractedDate || detectedRecurrence;
    const itemType = hasDate ? 'reminder' : 'task';

    const reminderDate = extractedDate && !detectedRecurrence ? extractedDate : undefined;

    const recurrence = detectedRecurrence ? {
      frequency: detectedRecurrence.frequency,
      time: detectedRecurrence.time,
      originalText: detectedRecurrence.originalText
    } : undefined;

    try {
      // Use AI-suggested list if available, otherwise use current selection
      let targetListId: string;
      if (aiSuggestedListId) {
        // Always prefer AI suggestion when available
        targetListId = aiSuggestedListId;
      } else if (currentListId === 'all') {
        // If on "All" view with no AI suggestion, use first list
        targetListId = lists[0]?.id;
      } else {
        // Otherwise use the currently selected list
        targetListId = currentListId;
      }

      const newItemId = await addItem({
        type: itemType,
        title: extractedTitle,
        priority: aiSuggestedPriority, // Use AI-suggested priority instead of manual selection
        status: itemType === 'task' ? (defaultColumn as any || 'start') : 'within7',
        listId: targetListId,
        reminderDate,
        recurrence,
      } as any);

      // Navigation logic - simplified and complete
      // 1. Determine target view based on item type
      let targetView: ViewMode;
      if (recurrence) {
        targetView = 'recurring';
      } else if (reminderDate) {
        targetView = 'reminders';
      } else {
        targetView = 'tasks';
      }

      // 2. Switch to the target list if it's different from current
      if (currentListId !== targetListId) {
        setCurrentList(targetListId);
      }

      // 3. Navigate to the appropriate view
      if (targetView !== currentView) {
        setCurrentView(targetView);
      }

      // 4. Highlight the new item after view/list change completes
      setTimeout(() => {
        setHighlightedItem(newItemId);
      }, 100);
    } catch (error) {
      console.error('Failed to add item:', error);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50" onClick={onClose}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-lg font-semibold mb-4">
            New Item
          </h2>

          {/* AI Info - above title */}
          <p className="text-xs text-gray-600 mb-3">
            Your task will be automatically matched to the best list and assigned the appropriate priority based on the title.
          </p>

          {/* Title */}
          <div className="mb-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              spellCheck="true"
            />
            {mode === 'create' && (() => {
              // Check for recurring patterns
              const recurringMatch = title.match(/\b(every\s+(other\s+)?\d*\s*(day|week|month|year|hours?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?)|daily|weekly|monthly|yearly|annually|weekdays?|weekends?)\b/i);
              if (recurringMatch) {
                // Format the recurring pattern nicely
                let patternText = recurringMatch[0].toLowerCase();

                // Expand day abbreviations
                const dayMap: Record<string, string> = {
                  'mon': 'Monday', 'monday': 'Monday',
                  'tue': 'Tuesday', 'tuesday': 'Tuesday',
                  'wed': 'Wednesday', 'wednesday': 'Wednesday',
                  'thu': 'Thursday', 'thursday': 'Thursday',
                  'fri': 'Friday', 'friday': 'Friday',
                  'sat': 'Saturday', 'saturday': 'Saturday',
                  'sun': 'Sunday', 'sunday': 'Sunday'
                };

                // Replace abbreviated days with full names
                Object.entries(dayMap).forEach(([abbr, full]) => {
                  const regex = new RegExp(`\\b${abbr}\\b`, 'i');
                  if (regex.test(patternText)) {
                    patternText = patternText.replace(regex, full);
                  }
                });

                // Capitalize first letter
                let displayText = patternText.charAt(0).toUpperCase() + patternText.slice(1);

                // Parse time (with or without AM/PM)
                const timeMatch = title.match(/\b(at\s+)?(\d{1,2})(:\d{2})?\s*(am|pm|AM|PM)?\b/i);
                if (timeMatch && timeMatch[2]) {
                  let hours = parseInt(timeMatch[2], 10);
                  const minutes = timeMatch[3] ? parseInt(timeMatch[3].slice(1), 10) : 0;

                  // Parse AM/PM or use smart defaults
                  if (timeMatch[4]) {
                    const isPM = timeMatch[4].toLowerCase() === 'pm';
                    if (isPM && hours !== 12) hours += 12;
                    if (!isPM && hours === 12) hours = 0;
                  } else if (hours >= 1 && hours <= 11) {
                    hours += 12; // Default to PM
                  }

                  // Format time nicely
                  const period = hours >= 12 ? 'PM' : 'AM';
                  const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                  const formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

                  displayText += ` at ${formattedTime}`;
                }

                return (
                  <div className="text-xs text-gray-500 mt-1">
                    Recurring pattern detected: {displayText}
                  </div>
                );
              }

              // Check for single date (expand number words first for "at three" etc.)
              const expandNumberWords = (text: string) => {
                const numberWords: Record<string, string> = {
                  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
                  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
                  'eleven': '11', 'twelve': '12'
                };
                let result = text;
                Object.entries(numberWords).forEach(([word, number]) => {
                  const regex = new RegExp(`\\b${word}\\b`, 'gi');
                  result = result.replace(regex, number);
                });
                return result;
              };

              const expandedTitle = expandNumberWords(title);
              const parsed = customChrono.parse(expandedTitle);
              if (parsed.length > 0) {
                return (
                  <div className="text-xs text-gray-500 mt-1">
                    Date detected: {format(parsed[0].start.date(), 'MMM d, yyyy h:mm a')}
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className={`px-4 py-2 transition-colors ${
                  isProcessing
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className={`px-4 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                  isProcessing 
                    ? 'bg-blue-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isProcessing && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isProcessing ? 'Processing...' : 'Create'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};