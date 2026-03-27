import { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Edit,
  Eye,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingLogo } from '../../components/LoadingLogo';

interface EmailTemplate {
  id: string;
  template_type: string;
  subject: string;
  html_content: string;
  variables: string[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  template_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface ZeptoMailConfig {
  id: string;
  api_token: string;
  from_email: string;
  from_name: string;
  bounce_address: string | null;
  is_active: boolean;
}

export const EmailManagementTab = (): JSX.Element => {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'logs' | 'config'>('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [config, setConfig] = useState<ZeptoMailConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template editing state
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isPreviewingTemplate, setIsPreviewingTemplate] = useState(false);
  const [templateFormData, setTemplateFormData] = useState({
    subject: '',
    html_content: ''
  });

  // Config editing state
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    api_token: '',
    from_email: '',
    from_name: '',
    bounce_address: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Test email state
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);
  const [testEmailData, setTestEmailData] = useState({
    recipient_email: '',
    template_type: 'welcome'
  });
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email queue processing state
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueResult, setQueueResult] = useState<{ processed: number; sent: number; failed: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (activeSubTab === 'templates') {
        await fetchTemplates();
      } else if (activeSubTab === 'logs') {
        await fetchEmailLogs();
      } else if (activeSubTab === 'config') {
        await fetchConfig();
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('template_type');

    if (error) throw error;
    setTemplates(data || []);
  };

  const fetchEmailLogs = async () => {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    setEmailLogs(data || []);
  };

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('zeptomail_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    setConfig(data);
    if (data) {
      setConfigFormData({
        api_token: data.api_token,
        from_email: data.from_email,
        from_name: data.from_name,
        bounce_address: data.bounce_address || ''
      });
    }
  };

  const getSampleVariables = (templateType: string): Record<string, string> => {
    const samples: Record<string, Record<string, string>> = {
      welcome: {
        user_name: 'John Doe',
        user_email: 'john.doe@example.com',
        app_url: 'https://airaplay.com'
      },
      purchase_treat: {
        user_name: 'John Doe',
        amount: '1000',
        transaction_id: 'TXN123456789',
        payment_method: 'Paystack',
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      },
      approved_withdrawal: {
        user_name: 'John Doe',
        amount: '5000.00',
        currency: 'NGN',
        payment_method: 'Bank Transfer',
        account_details: '**** **** **** 1234'
      },
      newsletter: {
        user_name: 'John Doe',
        trending_content: 'Check out the hottest tracks this week!',
        new_releases: 'Fresh music from your favorite artists.',
        featured_artists: 'Discover talented new creators.',
        app_url: 'https://airaplay.com',
        unsubscribe_url: 'https://airaplay.com/unsubscribe'
      },
      weekly_report: {
        user_name: 'Artist Name',
        date_range: 'Jan 1 - Jan 7, 2026',
        plays: '1,234',
        likes: '456',
        shares: '89',
        earnings: 'NGN 2,500',
        new_followers: '23',
        top_track: 'Amazing Song Title'
      }
    };
    return samples[templateType] || {};
  };

  const handleRunEmailQueue = async () => {
    try {
      setIsProcessingQueue(true);
      setQueueResult(null);
      setError(null);

      const { data, error } = await supabase.functions.invoke('process-email-queue', {
        method: 'POST',
        body: {},
      });

      if (error) {
        console.error('Error running email queue:', error);
        setError(error.message || 'Failed to run email queue');
        return;
      }

      const processed = data?.processed ?? 0;
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      setQueueResult({ processed, sent, failed });

      // Refresh logs so admin can see the latest sends/failures.
      await fetchEmailLogs();
    } catch (err: any) {
      console.error('Error running email queue:', err);
      setError(err?.message || 'Failed to run email queue');
    } finally {
      setIsProcessingQueue(false);
      // Auto-clear queue result after a short delay
      setTimeout(() => setQueueResult(null), 6000);
    }
  };

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewingTemplate(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormData({
      subject: template.subject,
      html_content: template.html_content
    });
    setIsEditingTemplate(true);
  };

  const getPreviewContent = (template: EmailTemplate): { subject: string; html: string } => {
    const sampleVars = getSampleVariables(template.template_type);
    let subject = template.subject;
    let html = template.html_content;

    // Replace variables with sample data
    for (const [key, value] of Object.entries(sampleVars)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(placeholder, value);
      html = html.replace(placeholder, value);
    }

    return { subject, html };
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: templateFormData.subject,
          html_content: templateFormData.html_content,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      setSaveSuccess('Template updated successfully');
      setIsEditingTemplate(false);
      setSelectedTemplate(null);
      fetchTemplates();

      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving template:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      if (config) {
        // Update existing config
        const { error } = await supabase
          .from('zeptomail_config')
          .update({
            api_token: configFormData.api_token,
            from_email: configFormData.from_email,
            from_name: configFormData.from_name,
            bounce_address: configFormData.bounce_address || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Create new config
        const { error } = await supabase
          .from('zeptomail_config')
          .insert({
            api_token: configFormData.api_token,
            from_email: configFormData.from_email,
            from_name: configFormData.from_name,
            bounce_address: configFormData.bounce_address || null,
            is_active: true
          });

        if (error) throw error;
      }

      setSaveSuccess('Configuration saved successfully');
      setIsEditingConfig(false);
      fetchConfig();

      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving config:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailData.recipient_email || !testEmailData.template_type) {
      setTestResult({ success: false, message: 'Please enter recipient email and select template' });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      // Get sample variables for the template
      const sampleVars = getSampleVariables(testEmailData.template_type);

      // Call the send-email edge function
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          template_type: testEmailData.template_type,
          recipient_email: testEmailData.recipient_email,
          variables: sampleVars
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setTestResult({
        success: true,
        message: `Test email sent successfully to ${testEmailData.recipient_email}`
      });

      // Refresh email logs
      if (activeSubTab === 'logs') {
        fetchEmailLogs();
      }

      // Reset form after 3 seconds
      setTimeout(() => {
        setTestEmailData({
          recipient_email: '',
          template_type: 'welcome'
        });
        setTestResult(null);
      }, 3000);
    } catch (err) {
      console.error('Error sending test email:', err);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send test email'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const getTemplateTypeName = (type: string): string => {
    const names: Record<string, string> = {
      welcome: 'Welcome Email',
      purchase_treat: 'Treat Purchase',
      approved_withdrawal: 'Withdrawal Approved',
      newsletter: 'Weekly Newsletter',
      weekly_report: 'Creator Weekly Report'
    };
    return names[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { class: string; label: string }> = {
      pending: { class: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
      sent: { class: 'bg-green-100 text-green-700 border-green-200', label: 'Sent' },
      failed: { class: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
      bounced: { class: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Bounced' }
    };
    return badges[status] || badges.pending;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSubTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Templates
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSubTab === 'logs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Email Logs
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('config')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSubTab === 'config'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              ZeptoMail Config
            </div>
          </button>
        </nav>
      </div>

      {/* Success/Error Messages */}
      {(saveSuccess || saveError) && (
        <div className={`p-4 rounded-lg ${
          saveError ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
        }`}>
          <p className={`${
            saveError ? 'text-red-700' : 'text-green-700'
          }`}>
            {saveError || saveSuccess}
          </p>
        </div>
      )}

      {/* Email Templates Tab */}
      {activeSubTab === 'templates' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Email Templates</h3>
            <button
              onClick={() => setIsTestEmailOpen(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Test Email
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingLogo variant="pulse" size={32} />
              <p className="ml-4 text-gray-700">Loading templates...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-100 border border-red-200 rounded-lg text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium text-gray-900">
                        {getTemplateTypeName(template.template_type)}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          template.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-500">Version {template.version}</span>
                        <span className="text-xs text-gray-500">
                          Variables: {template.variables.join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePreviewTemplate(template)}
                        className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Email Logs Tab */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Email Logs</h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingLogo variant="pulse" size={32} />
              <p className="ml-4 text-gray-700">Loading logs...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-100 border border-red-200 rounded-lg text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700">{error}</p>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="p-6 bg-gray-100 rounded-lg text-center">
              <p className="text-gray-700">No email logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 text-gray-700 font-medium">Type</th>
                    <th className="p-3 text-gray-700 font-medium">Recipient</th>
                    <th className="p-3 text-gray-700 font-medium">Subject</th>
                    <th className="p-3 text-gray-700 font-medium">Status</th>
                    <th className="p-3 text-gray-700 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log) => {
                    const statusBadge = getStatusBadge(log.status);
                    return (
                      <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3 text-gray-900">
                          {getTemplateTypeName(log.template_type)}
                        </td>
                        <td className="p-3 text-gray-900">{log.recipient_email}</td>
                        <td className="p-3 text-gray-900">{log.subject}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs border ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                          {log.error_message && (
                            <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                          )}
                        </td>
                        <td className="p-3 text-gray-700 text-sm">
                          {log.sent_at ? formatDate(log.sent_at) : formatDate(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ZeptoMail Config Tab */}
      {activeSubTab === 'config' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">ZeptoMail Configuration</h3>
            {!isEditingConfig && (
              <button
                onClick={() => setIsEditingConfig(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Config
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingLogo variant="pulse" size={32} />
              <p className="ml-4 text-gray-700">Loading configuration...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-100 border border-red-200 rounded-lg text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700">{error}</p>
            </div>
          ) : isEditingConfig ? (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  API Token *
                </label>
                <input
                  type="password"
                  value={configFormData.api_token}
                  onChange={(e) => setConfigFormData({ ...configFormData, api_token: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Your ZeptoMail API token"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Get your API token from <a href="https://www.zeptomail.zoho.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ZeptoMail Dashboard</a>
                </p>
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  From Email *
                </label>
                <input
                  type="email"
                  value={configFormData.from_email}
                  onChange={(e) => setConfigFormData({ ...configFormData, from_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="noreply@yourdomain.com"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  From Name *
                </label>
                <input
                  type="text"
                  value={configFormData.from_name}
                  onChange={(e) => setConfigFormData({ ...configFormData, from_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Airaplay"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Bounce Address (Optional)
                </label>
                <input
                  type="email"
                  value={configFormData.bounce_address}
                  onChange={(e) => setConfigFormData({ ...configFormData, bounce_address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="bounce@yourdomain.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsEditingConfig(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSaving || !configFormData.api_token || !configFormData.from_email || !configFormData.from_name}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <LoadingLogo variant="pulse" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : config ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">ZeptoMail is configured and active</span>
                </div>
                <button
                  onClick={() => setIsTestEmailOpen(true)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  Test Connection
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">From Email</p>
                  <p className="text-gray-900 font-medium">{config.from_email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">From Name</p>
                  <p className="text-gray-900 font-medium">{config.from_name}</p>
                </div>
                {config.bounce_address && (
                  <div>
                    <p className="text-sm text-gray-500">Bounce Address</p>
                    <p className="text-gray-900 font-medium">{config.bounce_address}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
              <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-yellow-700 mb-4">ZeptoMail is not configured</p>
              <button
                onClick={() => setIsEditingConfig(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Configure Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Template Edit Modal */}
      {isEditingTemplate && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Edit {getTemplateTypeName(selectedTemplate.template_type)}
                </h3>
                <button
                  onClick={() => {
                    setIsEditingTemplate(false);
                    setSelectedTemplate(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={templateFormData.subject}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    HTML Content
                  </label>
                  <textarea
                    value={templateFormData.html_content}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, html_content: e.target.value })}
                    rows={20}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Available variables: {selectedTemplate.variables.map(v => `{{${v}}}`).join(', ')}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsEditingTemplate(false);
                      setSelectedTemplate(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <LoadingLogo variant="pulse" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Preview Modal */}
      {isPreviewingTemplate && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Preview: {getTemplateTypeName(selectedTemplate.template_type)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    This preview uses sample data to show how the email will appear to recipients
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsPreviewingTemplate(false);
                    setSelectedTemplate(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Email Subject */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-1">Subject:</p>
                  <p className="text-gray-900 font-medium">
                    {getPreviewContent(selectedTemplate).subject}
                  </p>
                </div>

                {/* Sample Variables Used */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs font-medium text-blue-700 mb-2">Sample Data Used:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(getSampleVariables(selectedTemplate.template_type)).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="font-mono text-blue-600">{'{{' + key + '}}'}</span>
                        <span className="text-gray-600"> = </span>
                        <span className="text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Body Preview */}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                    <p className="text-xs font-medium text-gray-700">Email Body:</p>
                  </div>
                  <div className="bg-white p-6 max-h-[500px] overflow-y-auto">
                    <iframe
                      srcDoc={getPreviewContent(selectedTemplate).html}
                      className="w-full min-h-[500px] border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setIsPreviewingTemplate(false);
                      setSelectedTemplate(null);
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {isTestEmailOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Send Test Email</h3>
                <button
                  onClick={() => {
                    setIsTestEmailOpen(false);
                    setTestResult(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Send a test email to verify your ZeptoMail configuration. The email will use sample data.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Email Template
                  </label>
                  <select
                    value={testEmailData.template_type}
                    onChange={(e) => setTestEmailData({ ...testEmailData, template_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="welcome">Welcome Email</option>
                    <option value="purchase_treat">Treat Purchase</option>
                    <option value="approved_withdrawal">Withdrawal Approved</option>
                    <option value="newsletter">Weekly Newsletter</option>
                    <option value="weekly_report">Creator Weekly Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    Recipient Email *
                  </label>
                  <input
                    type="email"
                    value={testEmailData.recipient_email}
                    onChange={(e) => setTestEmailData({ ...testEmailData, recipient_email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="test@example.com"
                  />
                </div>

                {testResult && (
                  <div className={`p-4 rounded-lg border ${
                    testResult.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      )}
                      <p className={`text-sm ${
                        testResult.success ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {testResult.message}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsTestEmailOpen(false);
                      setTestResult(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendTestEmail}
                    disabled={isSendingTest || !testEmailData.recipient_email}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSendingTest ? (
                      <>
                        <LoadingLogo variant="pulse" size={16} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Test
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
