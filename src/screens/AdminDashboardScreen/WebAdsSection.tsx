import { useState, useEffect } from 'react';
import { Monitor, Save, RefreshCw, AlertCircle, CheckCircle, Info, Eye, EyeOff, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { webAdService, WebAdPlacement } from '../../lib/webAdService';

interface WebAdSlot {
  id: string;
  network: 'adsense' | 'monetag_web';
  slot_id: string;
  publisher_id: string;
  placement: WebAdPlacement;
  is_active: boolean;
}

interface PlacementMeta {
  label: string;
  description: string;
  badge?: string;
}

const PLACEMENT_META: Record<WebAdPlacement, PlacementMeta> = {
  banner_top: {
    label: 'Top Banner',
    description: '728×90 Leaderboard — full-width banner above all page content.',
  },
  banner_bottom: {
    label: 'Bottom Banner',
    description: '728×90 Leaderboard — full-width banner below all page content.',
  },
  sidebar: {
    label: 'Sidebar',
    description: '160×600 Wide Skyscraper — sticky ad in the left or right sidebar (xl screens only).',
  },
  in_feed: {
    label: 'In-Feed / Rectangle',
    description: '300×250 Medium Rectangle — inline with content in the sidebar.',
  },
  in_article: {
    label: 'In-Article (Native)',
    description: 'Fluid native ad that blends between paragraphs. AdSense auto-sizes it.',
    badge: 'Native',
  },
  anchor: {
    label: 'Anchor / Overlay',
    description: 'Sticky ad fixed to the bottom of the viewport. Dismissible by the user.',
    badge: 'Sticky',
  },
  responsive_display: {
    label: 'Responsive Display',
    description: 'Flexible display ad that fills any container. AdSense picks the best size.',
  },
  multiplex: {
    label: 'Matched Content (Multiplex)',
    description: 'Grid of content recommendations powered by AdSense.',
    badge: 'Grid',
  },
  interstitial_web: {
    label: 'Web Interstitial / Pop',
    description: 'Full-screen overlay triggered programmatically at navigation events.',
    badge: 'Triggered',
  },
  push_notification: {
    label: 'Push Notification Ads',
    description: 'Browser push notification campaigns. Users opt in to receive ads as notifications.',
    badge: 'Push',
  },
  native_banner: {
    label: 'Native Banner',
    description: 'Banner styled to match your site content for higher engagement.',
    badge: 'Native',
  },
  onclick_popunder: {
    label: 'Onclick / Popunder',
    description: 'Opens an advertiser page in a new tab on any user click. High CPM.',
    badge: 'High CPM',
  },
  in_page_push: {
    label: 'In-Page Push',
    description: 'Push-style notification banner rendered inside the page — no opt-in required.',
  },
  vignette: {
    label: 'Vignette / Full-Screen',
    description: 'Full-screen ad shown between page navigations. Triggered programmatically.',
    badge: 'Triggered',
  },
};

const NETWORK_COLORS: Record<string, string> = {
  adsense: 'bg-blue-100 text-blue-700',
  monetag_web: 'bg-orange-100 text-orange-700',
};

const NETWORK_LABELS: Record<string, string> = {
  adsense: 'Google AdSense',
  monetag_web: 'Monetag Web',
};

export function WebAdsSection() {
  const [slots, setSlots] = useState<WebAdSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<WebAdSlot | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('web_ad_config')
        .select('*')
        .order('network')
        .order('placement');

      if (error) throw error;
      setSlots((data as WebAdSlot[]) || []);
    } catch {
      setErrorMsg('Failed to load web ad configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerHotReload = async () => {
    setIsReloading(true);
    try {
      await webAdService.reload();
    } finally {
      setIsReloading(false);
    }
  };

  const handleEdit = (slot: WebAdSlot) => setEditingSlot({ ...slot });
  const handleCancel = () => setEditingSlot(null);

  const handleSave = async () => {
    if (!editingSlot) return;
    setIsSaving(editingSlot.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from('web_ad_config')
        .update({
          slot_id: editingSlot.slot_id.trim(),
          publisher_id: editingSlot.publisher_id.trim(),
          is_active: editingSlot.is_active,
        })
        .eq('id', editingSlot.id);

      if (error) throw error;

      setSlots(prev => prev.map(s => s.id === editingSlot.id ? { ...editingSlot } : s));
      setEditingSlot(null);
      setSuccessMsg(`Saved — applying to live web...`);

      await triggerHotReload();
      const label = PLACEMENT_META[editingSlot.placement]?.label ?? editingSlot.placement;
      setSuccessMsg(`${label} is now live on the web.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to save changes');
    } finally {
      setIsSaving(null);
    }
  };

  const handleToggle = async (slot: WebAdSlot) => {
    const updated = { ...slot, is_active: !slot.is_active };
    setIsSaving(slot.id);
    try {
      const { error } = await supabase
        .from('web_ad_config')
        .update({ is_active: updated.is_active })
        .eq('id', slot.id);

      if (error) throw error;

      setSlots(prev => prev.map(s => s.id === slot.id ? updated : s));
      setSuccessMsg(`Toggled — applying to live web...`);

      await triggerHotReload();
      const label = PLACEMENT_META[slot.placement]?.label ?? slot.placement;
      setSuccessMsg(`${label} is now ${updated.is_active ? 'live' : 'disabled'}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to toggle slot');
    } finally {
      setIsSaving(null);
    }
  };

  const adsenseSlots = slots.filter(s => s.network === 'adsense');
  const monetagSlots = slots.filter(s => s.network === 'monetag_web');

  return (
    <div className="space-y-4 min-h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Monitor className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Web Ads Configuration</h2>
            <p className="text-sm text-gray-400 mt-0.5">Configure web advertisement placements and networks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerHotReload}
            disabled={isReloading}
            title="Push current config to the live web app without a page reload"
            className="flex items-center gap-2 px-3 py-2 text-sm text-[#309605] hover:bg-green-50 border border-[#309605] rounded-lg transition-colors disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${isReloading ? 'animate-pulse' : ''}`} />
            {isReloading ? 'Applying...' : 'Apply Live'}
          </button>
          <button
            onClick={loadSlots}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How web ads work</p>
          <ul className="space-y-1 list-disc list-inside text-blue-700">
            <li>AdSense slots require your <strong>Publisher ID</strong> (ca-pub-XXXXXXXXXXXXXXXX) and an <strong>Ad Slot ID</strong> per placement.</li>
            <li>Monetag slots only require the <strong>Zone ID</strong> from your Monetag dashboard.</li>
            <li>After saving or toggling, the page auto-applies changes — no reload needed.</li>
            <li>Sidebar and In-Feed ads appear at <strong>xl (1280px+)</strong> screens only.</li>
            <li><strong>Triggered</strong> formats (Interstitial, Vignette) fire programmatically on navigation events.</li>
            <li><strong>Push Notification</strong> and <strong>Onclick/Popunder</strong> are activated by Monetag the moment the Zone ID script loads.</li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <NetworkCard
            title="Google AdSense"
            network="adsense"
            slots={adsenseSlots}
            editingSlot={editingSlot}
            isSaving={isSaving}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            onToggle={handleToggle}
            onEditChange={setEditingSlot}
          />
          <NetworkCard
            title="Monetag Web"
            network="monetag_web"
            slots={monetagSlots}
            editingSlot={editingSlot}
            isSaving={isSaving}
            onEdit={handleEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            onToggle={handleToggle}
            onEditChange={setEditingSlot}
          />
        </div>
      )}
    </div>
  );
}

interface NetworkCardProps {
  title: string;
  network: 'adsense' | 'monetag_web';
  slots: WebAdSlot[];
  editingSlot: WebAdSlot | null;
  isSaving: string | null;
  onEdit: (slot: WebAdSlot) => void;
  onCancel: () => void;
  onSave: () => void;
  onToggle: (slot: WebAdSlot) => void;
  onEditChange: (slot: WebAdSlot) => void;
}

function NetworkCard({ title, network, slots, editingSlot, isSaving, onEdit, onCancel, onSave, onToggle, onEditChange }: NetworkCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${NETWORK_COLORS[network]}`}>
            {NETWORK_LABELS[network]}
          </span>
          <span className="text-xs text-gray-400">{title}</span>
        </div>
        <span className="text-xs text-gray-500">{slots.filter(s => s.is_active).length}/{slots.length} active</span>
      </div>

      <div className="divide-y divide-gray-100">
        {slots.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">No slots configured</div>
        )}
        {slots.map(slot => {
          const isEditing = editingSlot?.id === slot.id;
          const saving = isSaving === slot.id;
          const meta = PLACEMENT_META[slot.placement];

          return (
            <div key={slot.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{meta?.label ?? slot.placement}</p>
                    {meta?.badge && (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">
                        {meta.badge}
                      </span>
                    )}
                  </div>
                  {meta?.description && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{meta.description}</p>
                  )}
                </div>
                <button
                  onClick={() => onToggle(slot)}
                  disabled={saving}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    slot.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {saving ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : slot.is_active ? (
                    <Eye className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                  {slot.is_active ? 'Live' : 'Off'}
                </button>
              </div>

              {isEditing && editingSlot ? (
                <div className="space-y-3 mt-3">
                  {network === 'adsense' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Publisher ID (ca-pub-...)</label>
                      <input
                        type="text"
                        value={editingSlot.publisher_id}
                        onChange={e => onEditChange({ ...editingSlot, publisher_id: e.target.value })}
                        placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#309605] focus:border-transparent outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {network === 'adsense' ? 'Ad Slot ID' : 'Zone ID'}
                    </label>
                    <input
                      type="text"
                      value={editingSlot.slot_id}
                      onChange={e => onEditChange({ ...editingSlot, slot_id: e.target.value })}
                      placeholder={network === 'adsense' ? '1234567890' : '1234567'}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#309605] focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={onSave}
                      disabled={!!saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#309605] hover:bg-[#3ba208] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save & Apply
                    </button>
                    <button
                      onClick={onCancel}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 mt-2">
                  {network === 'adsense' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">Publisher ID:</span>
                      <span className="text-xs text-gray-700 font-mono truncate">
                        {slot.publisher_id || <span className="text-gray-400 italic">not set</span>}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-24 flex-shrink-0">
                      {network === 'adsense' ? 'Slot ID:' : 'Zone ID:'}
                    </span>
                    <span className="text-xs text-gray-700 font-mono truncate">
                      {slot.slot_id || <span className="text-gray-400 italic">not set</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => onEdit(slot)}
                    className="mt-2 text-xs text-[#309605] hover:text-[#3ba208] font-medium transition-colors"
                  >
                    Edit configuration
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
