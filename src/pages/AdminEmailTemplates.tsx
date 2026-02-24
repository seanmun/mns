import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  description: string | null;
  updated_at: string;
}

export function AdminEmailTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editHtmlBody, setEditHtmlBody] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Failed to fetch templates:', error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }

  function selectTemplate(tmpl: EmailTemplate) {
    setSelected(tmpl);
    setEditSubject(tmpl.subject);
    setEditHtmlBody(tmpl.html_body);
    setEditDescription(tmpl.description || '');
    setShowPreview(false);
    setMessage(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from('email_templates')
      .update({
        subject: editSubject,
        html_body: editHtmlBody,
        description: editDescription,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: 'Template saved' });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? { ...t, subject: editSubject, html_body: editHtmlBody, description: editDescription, updated_at: new Date().toISOString() }
            : t
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, subject: editSubject, html_body: editHtmlBody, description: editDescription } : prev
      );
    }
    setSaving(false);
  }

  async function handleSendTest() {
    if (!user?.email || !selected) return;
    setSendingTest(true);
    setMessage(null);

    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          template: selected.name,
          to: [user.email],
          data: {
            proposerTeamName: 'Test Team A',
            recipientTeamName: 'Test Team B',
            acceptingTeamName: 'Test Team B',
            rejectingTeamName: 'Test Team B',
            opponentTeamName: 'Test Team B',
            weekLabel: 'Matchup 12',
            assetSummary: 'LeBron James ($45M), Draft Pick Rd 3',
            description: 'Loser buys winner dinner',
            amount: '$50',
            note: 'This is a test email',
            inboxUrl: 'https://moneyneversleeps.app/teams',
          },
        },
      });

      if (error) {
        setMessage({ type: 'error', text: `Test send failed: ${error.message}` });
      } else {
        setMessage({ type: 'success', text: `Test email sent to ${user.email}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Test send failed: ${err.message}` });
    }
    setSendingTest(false);
  }

  function handlePreview() {
    setShowPreview(!showPreview);
    if (!showPreview && iframeRef.current) {
      setTimeout(() => {
        if (iframeRef.current) {
          const doc = iframeRef.current.contentDocument;
          if (doc) {
            doc.open();
            doc.write(editHtmlBody || '<p style="color: #999; font-family: sans-serif; text-align: center; padding: 40px;">No HTML body configured</p>');
            doc.close();
          }
        }
      }, 50);
    }
  }

  // Update iframe when preview is shown and HTML changes
  useEffect(() => {
    if (showPreview && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(editHtmlBody || '<p style="color: #999; font-family: sans-serif; text-align: center; padding: 40px;">No HTML body configured</p>');
        doc.close();
      }
    }
  }, [showPreview, editHtmlBody]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-2">Email Templates</h1>
        <p className="text-gray-400 mb-8">
          Manage transactional email templates. Edit HTML, preview, and send test emails.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template List */}
          <div className="lg:col-span-1">
            <div className="bg-[#121212] rounded-lg border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-300">Templates</h2>
              </div>
              <div className="divide-y divide-gray-800">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => selectTemplate(tmpl)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      selected?.id === tmpl.id
                        ? 'bg-green-400/10 border-l-2 border-green-400'
                        : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">{tmpl.name}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{tmpl.description}</div>
                    {tmpl.html_body ? (
                      <span className="inline-block mt-1 text-xs text-green-400">configured</span>
                    ) : (
                      <span className="inline-block mt-1 text-xs text-yellow-400">needs HTML</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="bg-[#121212] rounded-lg border border-gray-800">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {new Date(selected.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePreview}
                      className="px-3 py-1.5 text-sm border border-gray-700 rounded-md text-gray-300 hover:border-green-400 hover:text-green-400 transition-colors cursor-pointer"
                    >
                      {showPreview ? 'Hide Preview' : 'Preview'}
                    </button>
                    <button
                      onClick={handleSendTest}
                      disabled={sendingTest || !editHtmlBody}
                      className="px-3 py-1.5 text-sm border border-gray-700 rounded-md text-gray-300 hover:border-green-400 hover:text-green-400 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {sendingTest ? 'Sending...' : 'Send Test'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 text-sm border-2 border-green-400 text-green-400 rounded-md hover:bg-green-400/10 transition-colors disabled:opacity-50 font-semibold cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {message && (
                  <div
                    className={`mx-6 mt-4 px-4 py-2 rounded-md text-sm ${
                      message.type === 'success'
                        ? 'bg-green-400/10 text-green-400 border border-green-400/30'
                        : 'bg-red-400/10 text-red-400 border border-red-400/30'
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use {'{{variableName}}'} for dynamic content
                    </p>
                  </div>

                  {/* HTML Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">HTML Body</label>
                    <textarea
                      value={editHtmlBody}
                      onChange={(e) => setEditHtmlBody(e.target.value)}
                      rows={20}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono leading-relaxed resize-y"
                      placeholder="Paste your HTML email template here..."
                    />
                  </div>

                  {/* Preview */}
                  {showPreview && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Preview</label>
                      <div className="border border-gray-700 rounded-md overflow-hidden bg-white">
                        <iframe
                          ref={iframeRef}
                          title="Email Preview"
                          className="w-full"
                          style={{ height: '600px', border: 'none' }}
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#121212] rounded-lg border border-gray-800 p-12 text-center">
                <p className="text-gray-500">Select a template to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
