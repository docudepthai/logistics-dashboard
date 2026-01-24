'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } else {
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
}

export default function NotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const createNote = async () => {
    const newNote: Partial<Note> = {
      title: '',
      content: '',
    };

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote),
      });

      if (res.ok) {
        const created = await res.json();
        setNotes(prev => [created, ...prev]);
        setSelectedNote(created);
        setTimeout(() => titleRef.current?.focus(), 100);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const updateNote = async (note: Note) => {
    setSaving(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });

      if (res.ok) {
        const updated = await res.json();
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
        setSelectedNote(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const res = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId }),
      });

      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== noteId));
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleTitleChange = (value: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, title: value };
    setSelectedNote(updated);
    debouncedSave(updated);
  };

  const handleContentChange = (value: string) => {
    if (!selectedNote) return;
    const updated = { ...selectedNote, content: value };
    setSelectedNote(updated);
    debouncedSave(updated);
  };

  const debouncedSave = (note: Note) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      updateNote(note);
    }, 500);
  };

  const filteredNotes = searchQuery.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  // Sort by updatedAt descending
  const sortedNotes = [...filteredNotes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] -m-6">
      {/* Sidebar - Notes List */}
      <div className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-950">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">Notes</h1>
            <button
              onClick={createNote}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors"
              title="New Note"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 text-sm bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto">
          {sortedNotes.length === 0 ? (
            <div className="p-4 text-center text-neutral-500 text-sm">
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/50">
              {sortedNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 hover:bg-neutral-800/50 transition-colors ${
                    selectedNote?.id === note.id ? 'bg-neutral-800' : ''
                  }`}
                >
                  <div className="font-medium text-white text-sm truncate">
                    {note.title || 'Untitled'}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-neutral-500 text-xs">{formatDate(note.updatedAt)}</span>
                    <span className="text-neutral-600 text-xs truncate">
                      {note.content.slice(0, 30) || 'No content'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 text-center text-neutral-600 text-xs">
          {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col bg-neutral-900/30">
        {selectedNote ? (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
              <div className="text-xs text-neutral-500">
                {saving ? 'Saving...' : `Last edited ${formatDate(selectedNote.updatedAt)}`}
              </div>
              <button
                onClick={() => {
                  if (confirm('Delete this note?')) {
                    deleteNote(selectedNote.id);
                  }
                }}
                className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
              <input
                ref={titleRef}
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Title"
                className="w-full text-2xl font-semibold text-white bg-transparent border-none outline-none placeholder-neutral-600 mb-4"
              />
              <textarea
                ref={contentRef}
                value={selectedNote.content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start writing..."
                className="w-full h-[calc(100%-60px)] text-neutral-300 bg-transparent border-none outline-none resize-none placeholder-neutral-600 leading-relaxed"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <p>Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
