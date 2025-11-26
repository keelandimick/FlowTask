import React, { useState, useRef, useEffect } from 'react';
import { useStoreWithAuth } from '../store/useStoreWithAuth';
import { format } from 'date-fns';
import { processTextWithAI, renderTextWithLinks } from '../lib/ai';
import { formatRecurrence } from '../lib/formatRecurrence';

interface NotesProps {
  isOpen: boolean;
}

export const Notes: React.FC<NotesProps> = ({ isOpen }) => {
  const { selectedItemId, items, addNote, deleteNote, updateNote, updateItem } = useStoreWithAuth();
  const [noteInput, setNoteInput] = useState('');
  const [showOnHoldTag, setShowOnHoldTag] = useState(false);
  const [showOffHoldTag, setShowOffHoldTag] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isEditProcessing, setIsEditProcessing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLInputElement>(null);
  const offHoldContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when Notes panel opens
  useEffect(() => {
    if (isOpen && inputRef.current && !showOnHoldTag && !showOffHoldTag) {
      // Small delay to ensure the panel is fully rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, selectedItemId, showOnHoldTag, showOffHoldTag]);

  // Auto-focus OFF HOLD container when it appears
  useEffect(() => {
    if (showOffHoldTag && offHoldContainerRef.current) {
      offHoldContainerRef.current.focus();
    }
  }, [showOffHoldTag]);

  const selectedItem = items.find(item => item.id === selectedItemId);

  // Check if item has an active "on hold" status in metadata
  const onHoldData = selectedItem?.metadata?.onHold as { reason?: string } | undefined;
  const isOnHold = !!onHoldData;
  const onHoldReason = isOnHold ? (onHoldData?.reason || 'No reason provided') : null;

  const handleAddNote = async () => {
    if (!selectedItem || isProcessing) return;

    // For OFF HOLD, clear the hold status
    if (showOffHoldTag) {
      setIsProcessing(true);
      try {
        const newMetadata = { ...(selectedItem.metadata || {}), onHold: undefined };
        await updateItem(selectedItem.id, { metadata: newMetadata });
        setNoteInput('');
        setShowOffHoldTag(false);
      } catch (error) {
        console.error('Failed to clear hold status:', error);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // For ON HOLD, set the hold status in metadata
    if (showOnHoldTag) {
      setIsProcessing(true);
      const reason = holdReason.trim();
      try {
        const newMetadata = {
          ...(selectedItem.metadata || {}),
          onHold: reason ? { reason } : {}
        };
        await updateItem(selectedItem.id, { metadata: newMetadata });
        setNoteInput('');
        setShowOnHoldTag(false);
        setHoldReason('');
      } catch (error) {
        console.error('Failed to set hold status:', error);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Regular note
    if (!noteInput.trim()) return;

    setIsProcessing(true);
    let processedNote = noteInput.trim();

    try {
      // Process note with AI for spell correction
      const aiResult = await processTextWithAI(processedNote);
      processedNote = aiResult.correctedText || processedNote;

      await addNote(selectedItem.id, processedNote);
      setNoteInput('');
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editingContent.trim() || !selectedItem || isEditProcessing) return;

    setIsEditProcessing(true);
    let processedContent = editingContent.trim();

    try {
      // Process note with AI for spell correction (unless it's an ON HOLD note)
      if (!processedContent.toLowerCase().startsWith('on hold') && processedContent.toLowerCase() !== 'off hold') {
        const aiResult = await processTextWithAI(processedContent);
        processedContent = aiResult.correctedText || processedContent;
      }

      await updateNote(selectedItem.id, noteId, processedContent);
      setEditingNoteId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsEditProcessing(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedItem) return;

    if (window.confirm('Delete this note?')) {
      await deleteNote(selectedItem.id, noteId);
    }
  };

  // Detect when user types "on hold" or "off hold" to show tags
  useEffect(() => {
    const lower = noteInput.toLowerCase().trim();

    // When user types exactly "on hold", convert to tag mode
    if (lower === 'on hold' && !showOnHoldTag) {
      setShowOnHoldTag(true);
      setNoteInput('');
      // Focus the reason input after state updates
      setTimeout(() => reasonInputRef.current?.focus(), 0);
    }

    // When user types exactly "off hold", convert to tag mode
    if (lower === 'off hold' && !showOffHoldTag) {
      setShowOffHoldTag(true);
      setNoteInput('');
    }
  }, [noteInput, showOnHoldTag, showOffHoldTag]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-yellow-50"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-200 bg-yellow-100">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Notes
        </h3>
        <span className="text-xs text-gray-500 font-medium">{selectedItem?.notes.length || 0}</span>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1">
        {selectedItem ? (
          <>
            {/* Selected item info (read-only) */}
            <div className="px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
              <div className="px-2 py-1">
                <div className="text-sm font-medium text-gray-900">
                  {selectedItem.title}
                </div>

                {/* Date/time info (read-only) */}
                {(selectedItem.type === 'reminder' && selectedItem.reminderDate) && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{format(new Date(selectedItem.reminderDate), 'MMM d, yyyy \'at\' h:mm a')}</span>
                  </div>
                )}

                {selectedItem.recurrence && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{formatRecurrence(selectedItem.recurrence)}</span>
                  </div>
                )}
              </div>

              {/* ON HOLD indicator */}
              {isOnHold && (
                <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      ON HOLD
                    </span>
                    <span className="text-xs text-red-700">{onHoldReason}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {selectedItem.notes.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No notes yet
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItem.notes
                    .filter(note => {
                      // Filter out ON HOLD and OFF HOLD notes since we show them as banner
                      const lower = note.content.toLowerCase();
                      return !lower.startsWith('on hold') && lower !== 'off hold';
                    })
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((note) => {
                      const isEditing = editingNoteId === note.id;

                      return (
                        <div key={note.id} className="bg-white border border-gray-200 rounded p-3">
                          {isEditing ? (
                            // Edit mode
                            <div>
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && e.metaKey) {
                                    handleUpdateNote(note.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingNoteId(null);
                                    setEditingContent('');
                                  }
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleUpdateNote(note.id)}
                                  disabled={isEditProcessing}
                                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                >
                                  {isEditProcessing ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingContent('');
                                  }}
                                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // Display mode
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="text-sm text-gray-700">
                                  {renderTextWithLinks(note.content)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                                </div>
                              </div>

                              {/* Actions menu */}
                              <div className="relative">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingContent(note.content);
                                  }}
                                  className="text-gray-400 hover:text-blue-600 p-1"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-gray-400 hover:text-red-600 p-1 ml-1"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Note input */}
            <div className="px-3 py-3 bg-white border-t border-gray-200">
              {/* ON HOLD tag mode */}
              {showOnHoldTag && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                      ON HOLD
                    </span>
                    <input
                      ref={reasonInputRef}
                      type="text"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNote();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowOnHoldTag(false);
                          setHoldReason('');
                          setTimeout(() => inputRef.current?.focus(), 0);
                        } else if ((e.key === 'Backspace' || e.key === 'Delete') && !holdReason) {
                          // Clear tag if backspace/delete pressed when input is empty
                          e.preventDefault();
                          e.stopPropagation();
                          setShowOnHoldTag(false);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }
                      }}
                      placeholder="Reason for on hold?"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}

              {/* OFF HOLD tag mode */}
              {showOffHoldTag && (
                <div
                  ref={offHoldContainerRef}
                  className="flex items-center gap-2 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddNote();
                    } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') {
                      // Clear tag on Escape, Backspace, or Delete
                      e.preventDefault();
                      e.stopPropagation();
                      setShowOffHoldTag(false);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }
                  }}
                  tabIndex={0}
                >
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                    OFF HOLD
                  </span>
                  <div className="flex-1 px-3 py-2 text-sm text-gray-400 italic">
                    Press Enter to remove ON HOLD status
                  </div>
                  <button
                    onClick={handleAddNote}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}

              {/* Regular note input */}
              {!showOnHoldTag && !showOffHoldTag && (
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNote();
                      } else if (e.key === 'Escape') {
                        if (noteInput.trim()) {
                          // First Esc: Clear the input
                          e.preventDefault();
                          e.stopPropagation();
                          setNoteInput('');
                        } else {
                          // Second Esc (or first if empty): Blur to allow App.tsx to close Notes
                          e.currentTarget.blur();
                        }
                      }
                    }}
                    placeholder="Add a note..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim() || isProcessing}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Adding...' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select an item to view notes
          </div>
        )}
      </div>
    </div>
  );
};
