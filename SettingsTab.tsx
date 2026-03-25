import { motion } from 'motion/react';
import { Search, ArrowUpDown, X, Check, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import type { NewsItem } from '../types';

interface SettingsTabProps {
  disabledMedia: string[];
  setDisabledMedia: (media: string[]) => void;
  mediaSortOrder: 'name' | 'status';
  setMediaSortOrder: (order: 'name' | 'status') => void;
  mediaSearch: string;
  setMediaSearch: (search: string) => void;
  allMediaSources: string[];
  filteredMediaSources: string[];
  saveStatus: 'idle' | 'saved';
  setSaveStatus: (status: 'idle' | 'saved') => void;
  toggleMedia: (media: string) => void;
  news: NewsItem[];
}

export function SettingsTab({
  disabledMedia, setDisabledMedia, mediaSortOrder, setMediaSortOrder,
  mediaSearch, setMediaSearch, allMediaSources, filteredMediaSources,
  saveStatus, setSaveStatus, toggleMedia, news
}: SettingsTabProps) {
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

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2">系統設定</h2>
          <p className="text-black/40 font-medium">
            管理媒體來源與顯示偏好
          </p>
        </div>
      </div>

      <div className="apple-card p-4 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div>
            <h3 className="text-xl font-bold">媒體清單管理</h3>
            <div className="text-sm text-black/40 mt-1">
              已隱藏 {disabledMedia.length} 個媒體，共 {allMediaSources.length} 個
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
              <input
                type="text"
                placeholder="搜尋媒體..."
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-apple-gray/50 border-none rounded-full text-sm focus:ring-1 focus:ring-brand-red/30 outline-none w-full sm:w-48"
              />
            </div>
            <button
              onClick={() => setMediaSortOrder(mediaSortOrder === 'name' ? 'status' : 'name')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-apple-gray/50 hover:bg-apple-gray rounded-full text-sm font-medium transition-colors"
            >
              <ArrowUpDown className="w-4 h-4" />
              排序：{mediaSortOrder === 'name' ? '名稱' : '狀態'}
            </button>
            <div className="hidden sm:block h-4 w-px bg-apple-border/20 mx-1" />
            <div className="flex items-center justify-center gap-4 sm:gap-2">
              <button
                onClick={() => {
                  setDisabledMedia([]);
                  localStorage.setItem('disabledMedia', JSON.stringify([]));
                }}
                className="text-xs font-bold text-brand-red hover:underline px-2 py-1"
              >
                全部開啟
              </button>
              <button
                onClick={() => {
                  const all = Array.from(new Set(news.map(item => item.media)));
                  setDisabledMedia(all);
                  localStorage.setItem('disabledMedia', JSON.stringify(all));
                }}
                className="text-xs font-bold text-black/40 hover:underline px-2 py-1"
              >
                全部關閉
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMediaSources.map(media => {
            const isDisabled = disabledMedia.includes(media);
            return (
              <button
                key={media}
                onClick={() => toggleMedia(media)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all text-left relative overflow-hidden",
                  isDisabled 
                    ? "bg-apple-gray/50 border-apple-border/10 text-black/30" 
                    : "bg-white border-apple-border/30 text-black hover:border-brand-red/30"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium truncate mr-2">{media}</span>
                  {PREDEFINED_MEDIA.includes(media) && (
                    <span className="text-[10px] font-bold text-brand-red uppercase tracking-tighter mt-1">
                      高權重媒體
                    </span>
                  )}
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-colors shrink-0",
                  isDisabled ? "bg-black/5" : "bg-brand-red text-white"
                )}>
                  {isDisabled ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                </div>
              </button>
            );
          })}
        </div>

        {allMediaSources.length === 0 && (
          <div className="text-center py-12">
            <p className="text-black/30">請先獲取新聞以載入媒體清單</p>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-apple-border/10 flex justify-end">
          <button
            onClick={() => {
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
            }}
            className={cn(
              "apple-button flex items-center gap-2 px-8 py-3 transition-all",
              saveStatus === 'saved' ? "bg-emerald-500 text-white" : "bg-black text-white hover:bg-black/80"
            )}
          >
            {saveStatus === 'saved' ? (
              <>
                <Check className="w-5 h-5" />
                設定已儲存
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                儲存設定
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
