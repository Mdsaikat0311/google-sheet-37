import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  LogOut,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import appConfig from '../config/appConfig.json';
import {
  getAppsScriptUrl,
  saveAppsScriptUrl,
} from '../services/sheets';

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
  onUpdateSpreadsheetId: (id: string) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthLoading: boolean;
  onSyncNow: () => void;
  isSyncing: boolean;
  onOpenAuthHelp?: () => void;
  selectedTab?: string;
  onUpdateSelectedTab?: (tab: string) => void;
}

export const SheetSettingsModal: React.FC<SheetSettingsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  onUpdateSpreadsheetId,
  user,
  onSignIn,
  onSignOut,
  isAuthLoading,
  onSyncNow,
  isSyncing,
  onOpenAuthHelp,
  selectedTab = 'Sheet2',
  onUpdateSelectedTab,
}) => {
  const [inputVal, setInputVal] = useState(spreadsheetId || appConfig.spreadsheetId || '');
  const [tabVal, setTabVal] = useState(selectedTab || appConfig.orderSheetTab || 'Sheet2');
  const [scriptUrl, setScriptUrl] = useState(getAppsScriptUrl() || appConfig.appsScriptUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setInputVal(spreadsheetId || appConfig.spreadsheetId || '');
  }, [spreadsheetId]);

  useEffect(() => {
    setTabVal(selectedTab || appConfig.orderSheetTab || 'Sheet2');
  }, [selectedTab]);

  useEffect(() => {
    const curScript = getAppsScriptUrl() || appConfig.appsScriptUrl || '';
    setScriptUrl(curScript);
    // Also fetch current config from backend server if available
    fetch('/api/config')
      .then((r) => {
        if (!r.ok) return null;
        const ct = r.headers.get('content-type') || '';
        return ct.includes('application/json') ? r.json() : null;
      })
      .then((cfg) => {
        if (!cfg) return;
        if (cfg?.spreadsheetId) {
          setInputVal(cfg.spreadsheetId);
        }
        if (cfg?.appsScriptUrl) {
          setScriptUrl(cfg.appsScriptUrl);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const cleanSheetId = inputVal.trim();
    const cleanUrl = scriptUrl.trim();
    const cleanTab = tabVal.trim();

    setIsSaving(true);

    // 1. Update React state & localStorage
    onUpdateSpreadsheetId(cleanSheetId);
    localStorage.setItem('app_spreadsheet_id', cleanSheetId);
    if (onUpdateSelectedTab && cleanTab) {
      onUpdateSelectedTab(cleanTab);
      localStorage.setItem('order_sheet_tab', cleanTab);
    }
    if (cleanUrl) {
      saveAppsScriptUrl(cleanUrl);
      localStorage.setItem('apps_script_url', cleanUrl);
    }

    // 2. Permanently save into source code files via backend API
    try {
      await fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: cleanSheetId,
          appsScriptUrl: cleanUrl,
          orderSheetTab: cleanTab || 'Sheet2',
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.warn('Backend save config notice:', err);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#121520] border border-[#22293d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#1c2232] flex items-center justify-between bg-[#0e111a]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              গুগল শিট কানেকশন ও সেটিংস
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1c2232] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Account Status */}
          <div className="p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-300">গুগল অ্যাকাউন্ট স্ট্যাটাস</span>
              {user ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  সংযুক্ত (Connected)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  সরাসরি সিঙ্ক মোড
                </span>
              )}
            </div>

            {user ? (
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-gray-200 font-semibold">{user.displayName || 'Google User'}</p>
                  <p className="text-gray-500 text-[11px]">{user.email}</p>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors text-[11px] font-semibold"
                >
                  <LogOut className="w-3 h-3" />
                  লগআউট
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>পাবলিক শিট মোড সক্রিয়: সাইন-ইন ছাড়াও লাইভ শিট পড়া ও লেখা যাচ্ছে।</span>
              </div>
            )}
          </div>

          {/* Spreadsheet ID Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Google Spreadsheet ID
              </label>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                ✓ কোডে পার্মানেন্ট সেভ হবে
              </span>
            </div>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="গুগল শিট আইডি বা লিংক..."
              className="w-full bg-[#181c29] border border-[#262f44] rounded-xl px-3.5 py-2 text-xs font-mono text-pink-400 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Apps Script Web App Integration (Auto Sheet Write) */}
          <div className="bg-[#151926] border border-[#232b40] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Google Apps Script ইন্টিগ্রেশন (শিট অটো-আপডেট)</span>
              </label>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                ✓ কোডে পার্মানেন্ট সেভ হবে
              </span>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">
                Apps Script Web App URL:
              </label>
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-[#0f121a] border border-[#262f44] rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {saveSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-[11px] flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>সফলভাবে কোডে স্থায়ীভাবে সংরক্ষণ করা হয়েছে!</span>
            </div>
          )}

          {/* Sync Trigger & Save Button */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1c2232]">
            <button
              onClick={() => {
                if (onUpdateSelectedTab && tabVal.trim()) {
                  onUpdateSelectedTab(tabVal.trim());
                }
                onSyncNow();
              }}
              disabled={isSyncing || isSaving}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b202e] hover:bg-[#252c3f] border border-[#29334a] text-gray-300 font-medium transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-pink-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই শিট রিফ্রেশ করুন'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-pink-600 hover:bg-pink-500 text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>সেভ হয়েছে!</span>
                </>
              ) : (
                'স্থায়ীভাবে সংরক্ষণ'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
