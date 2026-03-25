import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from './lib/utils';
import type { NewsItem, ScheduleConfig } from './types';
import { NewsTab } from './components/NewsTab';
import { NewsletterTab } from './components/NewsletterTab';
import { SettingsTab } from './components/SettingsTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'news' | 'newsletter' | 'settings'>('news');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [disabledMedia, setDisabledMedia] = useState<string[]>(() => {
    const saved = localStorage.getItem('disabledMedia');
    return saved ? JSON.parse(saved) : [];
  });
  const [mediaSortOrder, setMediaSortOrder] = useState<'name' | 'status'>('name');
  const [mediaSearch, setMediaSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [sendingLine, setSendingLine] = useState(false);
  const [lineStatus, setLineStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lineError, setLineError] = useState<string>('');
  
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    lineTime: "09:00",
    edmTime: "09:00",
    edmEmail: "",
    lineEnabled: false,
    edmEnabled: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [scheduleStatus, setScheduleStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const PREDEFINED_MEDIA = [
    "中央社", "中央通訊社", "CNA", 
    "商業周刊", "商周", "Business Weekly", 
    "天下雜誌", "天下", "CommonWealth", 
    "數位時代", "Business Next", 
    "財訊", "Wealth Magazine", 
    "遠見雜誌", "遠見", "Global Views", 
    "工商時報", "工商", "Commercial Times", 
    "經濟日報", "經濟", "Economic Daily News", 
    "科技新報", "Technews", 
    "中時新聞網", "中時", "聯合新聞網", "聯合報", "UDN", 
    "自由時報", "LTN", "ETtoday新聞雲", "ETtoday", 
    "NOWnews今日新聞", "NOWnews", "TVBS", "三立新聞網", "三立"
  ];

  const allMediaSources = Array.from(new Set([
    ...news.map(item => item.media),
    ...PREDEFINED_MEDIA
  ])) as string[];
  
  const filteredMediaSources = allMediaSources
    .filter(media => media.toLowerCase().includes(mediaSearch.toLowerCase()))
    .sort((a, b) => {
      if (mediaSortOrder === 'name') {
        return a.localeCompare(b, 'zh-Hant');
      } else {
        const aDisabled = disabledMedia.includes(a);
        const bDisabled = disabledMedia.includes(b);
        if (aDisabled === bDisabled) return a.localeCompare(b, 'zh-Hant');
        return aDisabled ? 1 : -1;
      }
    });

  const filteredNews = news.filter(item => !disabledMedia.includes(item.media));

  const toggleMedia = (media: string) => {
    const next = disabledMedia.includes(media)
      ? disabledMedia.filter(m => m !== media)
      : [...disabledMedia, media];
    setDisabledMedia(next);
    localStorage.setItem('disabledMedia', JSON.stringify(next));
  };

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      setNews(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendLine = async () => {
    if (filteredNews.length === 0) return;
    setSendingLine(true);
    setLineStatus('idle');
    setLineError('');
    try {
      const res = await fetch('/api/line/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: filteredNews })
      });
      const data = await res.json();
      if (res.ok) {
        setLineStatus('success');
      } else {
        setLineStatus('error');
        setLineError(data.error || '未知錯誤');
      }
    } catch (err: any) {
      console.error('Failed to send LINE push:', err);
      setLineStatus('error');
      setLineError(err.message || '網路連線錯誤');
    } finally {
      setSendingLine(false);
      setTimeout(() => setLineStatus('idle'), 5000);
    }
  };

  const handleSendEmail = async () => {
    if (filteredNews.length === 0 || !emailAddress) return;
    setSendingEmail(true);
    setEmailStatus('idle');
    setEmailError('');
    try {
      const res = await fetch('/api/email/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: filteredNews, email: emailAddress })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailStatus('success');
        setEmailAddress('');
      } else {
        setEmailStatus('error');
        setEmailError(data.error || '未知錯誤');
      }
    } catch (err: any) {
      console.error('Failed to send Email push:', err);
      setEmailStatus('error');
      setEmailError(err.message || '網路連線錯誤');
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailStatus('idle'), 5000);
    }
  };

  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/schedule');
      const data = await res.json();
      setScheduleConfig({
        ...data,
        timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    }
  };

  const handleSaveSchedule = async () => {
    setScheduleStatus('saving');
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleConfig)
      });
      if (res.ok) {
        setScheduleStatus('success');
        setTimeout(() => setScheduleStatus('idle'), 3000);
      } else {
        setScheduleStatus('error');
      }
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setScheduleStatus('error');
    }
  };

  useEffect(() => {
    fetchNews();
    fetchSchedule();
  }, []);

  return (
    <div className="min-h-screen bg-apple-gray">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-apple-border/20">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-[#E72410] rounded-lg flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight hidden sm:block text-[#E72410]">
              零售觀察室
            </h1>
          </div>

          <nav className="flex bg-apple-gray/50 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-[60%] sm:max-w-none">
            <button
              onClick={() => setActiveTab('news')}
              className={cn(
                "apple-tab rounded-lg whitespace-nowrap px-3 py-1.5 text-sm md:text-base",
                activeTab === 'news' ? "bg-white text-black" : "text-black/40 hover:text-black/60"
              )}
            >
              輿情分析
            </button>
            <button
              onClick={() => setActiveTab('newsletter')}
              className={cn(
                "apple-tab rounded-lg whitespace-nowrap px-3 py-1.5 text-sm md:text-base",
                activeTab === 'newsletter' ? "bg-white text-black" : "text-black/40 hover:text-black/60"
              )}
            >
              通知與訂閱
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "apple-tab rounded-lg whitespace-nowrap px-3 py-1.5 text-sm md:text-base",
                activeTab === 'settings' ? "bg-white text-black" : "text-black/40 hover:text-black/60"
              )}
            >
              設定
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={fetchNews}
              disabled={loading}
              className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 hover:bg-apple-gray rounded-full transition-all disabled:opacity-50"
              title="手動更新"
            >
              <RefreshCw className={cn("w-4 h-4 text-black/60", loading && "animate-spin")} />
              <span className="text-sm font-medium text-black/60 hidden sm:block">更新</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'news' ? (
            <NewsTab 
               filteredNews={filteredNews} 
               loading={loading} 
               lastUpdated={lastUpdated} 
               disabledMediaCount={disabledMedia.length} 
               setActiveTab={setActiveTab} 
            />
          ) : activeTab === 'newsletter' ? (
            <NewsletterTab
               handleSendLine={handleSendLine}
               sendingLine={sendingLine}
               lineStatus={lineStatus}
               lineError={lineError}
               filteredNewsLength={filteredNews.length}
               scheduleConfig={scheduleConfig}
               setScheduleConfig={setScheduleConfig}
               handleSaveSchedule={handleSaveSchedule}
               scheduleStatus={scheduleStatus}
               emailAddress={emailAddress}
               setEmailAddress={setEmailAddress}
               handleSendEmail={handleSendEmail}
               sendingEmail={sendingEmail}
               emailStatus={emailStatus}
               emailError={emailError}
            />
          ) : (
            <SettingsTab 
               disabledMedia={disabledMedia}
               setDisabledMedia={setDisabledMedia}
               mediaSortOrder={mediaSortOrder}
               setMediaSortOrder={setMediaSortOrder}
               mediaSearch={mediaSearch}
               setMediaSearch={setMediaSearch}
               allMediaSources={allMediaSources}
               filteredMediaSources={filteredMediaSources}
               saveStatus={saveStatus}
               setSaveStatus={setSaveStatus}
               toggleMedia={toggleMedia}
               news={news}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-apple-border/10 py-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-black/30 text-sm font-medium">
            © 2026 零售觀察室. All rights reserved.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-black/30 hover:text-black/60 text-sm font-medium transition-colors">隱私權政策</a>
            <a href="#" className="text-black/30 hover:text-black/60 text-sm font-medium transition-colors">服務條款</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
