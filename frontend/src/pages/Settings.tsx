import { useState, useEffect } from 'react';
import { Save, RefreshCw, Check } from 'lucide-react';
import { api } from '../api';
import { translate as t, setLanguage } from '../i18n';
import type { Language } from '../i18n';

interface SettingsProps {
  lang: Language;
  setLang: (lang: Language) => void;
}

export default function Settings({ lang, setLang }: SettingsProps) {
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/config').then(res => setConfig(res.data)).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await api.post('/api/config', config);
      
      // Update localized state and localStorage
      if (config.language) {
        setLanguage(config.language as Language);
        setLang(config.language as Language);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert(t('settings.save.failed', lang));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    api.get('/api/config').then(res => setConfig(res.data)).catch(console.error);
  };

  if (!config) return <div className="p-8 text-[var(--color-text-muted)] animate-pulse">{lang === 'en' ? 'Loading configuration...' : '正在加载配置...'}</div>;

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('settings.title', lang)}</h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">{t('settings.desc', lang)}</p>
      </div>

      <div className="space-y-6">
        {/* General Settings Card */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[var(--color-border-base)] bg-[var(--color-bg-base)]/50">
            <h3 className="text-lg font-bold">{t('settings.general', lang)}</h3>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Listening Port */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.port', lang)}</label>
                <input 
                  type="number" 
                  value={config.port}
                  onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors text-sm font-medium"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{t('settings.port.desc', lang)}</p>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.lang', lang)}</label>
                <select 
                  value={config.language || 'zh'}
                  onChange={e => setConfig({...config, language: e.target.value})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors appearance-none text-sm font-medium"
                >
                  <option value="zh">{t('settings.lang.zh', lang)}</option>
                  <option value="en">{t('settings.lang.en', lang)}</option>
                </select>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{lang === 'en' ? 'Select your UI language preference.' : '选择用户界面的语言首选项。'}</p>
              </div>

              {/* Log Level */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.loglevel', lang)}</label>
                <select 
                  value={config.logLevel}
                  onChange={e => setConfig({...config, logLevel: e.target.value})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors appearance-none text-sm font-medium"
                >
                  <option value="debug">{t('settings.loglevel.debug', lang)}</option>
                  <option value="info">{t('settings.loglevel.info', lang)}</option>
                  <option value="warn">{t('settings.loglevel.warn', lang)}</option>
                  <option value="error">{t('settings.loglevel.error', lang)}</option>
                </select>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{lang === 'en' ? 'Log level for server console logs output.' : '服务控制台日志输出的详细程度级别。'}</p>
              </div>

              {/* Auto Sync Interval */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.autoSyncInterval', lang)}</label>
                <select 
                  value={config.autoSyncInterval || 'never'}
                  onChange={e => setConfig({...config, autoSyncInterval: e.target.value})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors appearance-none text-sm font-medium"
                >
                  <option value="never">{t('settings.autoSyncInterval.never', lang)}</option>
                  <option value="hourly">{t('settings.autoSyncInterval.hourly', lang)}</option>
                  <option value="daily">{t('settings.autoSyncInterval.daily', lang)}</option>
                </select>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{t('settings.autoSyncInterval.desc', lang)}</p>
              </div>

              {/* Default Temperature */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.defaultTemp', lang)}</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0" 
                  max="2"
                  value={config.defaultTemperature !== undefined ? config.defaultTemperature : 0.7}
                  onChange={e => setConfig({...config, defaultTemperature: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors text-sm font-medium"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{t('settings.defaultTemp.desc', lang)}</p>
              </div>

              {/* Default Max Tokens */}
              <div>
                <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t('settings.defaultMaxTokens', lang)}</label>
                <input 
                  type="number" 
                  value={config.defaultMaxTokens !== undefined ? config.defaultMaxTokens : 4096}
                  onChange={e => setConfig({...config, defaultMaxTokens: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors text-sm font-medium"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-2">{t('settings.defaultMaxTokens.desc', lang)}</p>
              </div>
            </div>

            {/* Boot Start Simulation (General general setting) */}
            <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-border-base)]">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.autoStart || false}
                  onChange={e => setConfig({...config, autoStart: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700 peer-checked:bg-[var(--color-primary)]"></div>
              </label>
              <span className="text-sm font-semibold">{t('settings.autostart', lang)}</span>
            </div>
          </div>
        </div>

        {/* Optimizations & Cache Settings Card */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[var(--color-border-base)] bg-[var(--color-bg-base)]/50">
            <h3 className="text-lg font-bold">{t('settings.cache', lang)}</h3>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <label className="relative inline-flex items-center cursor-pointer mt-0.5 shrink-0">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.cacheEnabled !== undefined ? config.cacheEnabled : true}
                  onChange={e => setConfig({...config, cacheEnabled: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700 peer-checked:bg-[var(--color-primary)]"></div>
              </label>
              <div>
                <span className="text-sm font-bold text-[var(--color-text-primary)] block">{t('settings.cache.enable', lang)}</span>
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5 max-w-2xl leading-relaxed">{t('settings.cache.desc', lang)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save & Cancel Buttons */}
        <div className="flex justify-end gap-4">
          <button 
            onClick={handleRevert}
            className="px-6 py-2.5 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-sm font-bold text-[var(--color-text-secondary)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> {t('settings.revert', lang)}
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
              saved ? 'bg-green-600 shadow-green-600/20' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--color-primary)]/20'
            } disabled:opacity-50`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.save.success', lang) : (isSaving ? t('settings.saving', lang) : t('settings.save', lang))}
          </button>
        </div>
      </div>
    </div>
  );
}
