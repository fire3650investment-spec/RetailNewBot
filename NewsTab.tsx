import { motion } from 'motion/react';
import { Newspaper, Clock, ChevronRight, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import type { NewsItem } from '../types';

interface NewsTabProps {
  filteredNews: NewsItem[];
  loading: boolean;
  lastUpdated: Date | null;
  disabledMediaCount: number;
  setActiveTab: (tab: 'news' | 'newsletter' | 'settings') => void;
}

export function NewsTab({ filteredNews, loading, lastUpdated, disabledMediaCount, setActiveTab }: NewsTabProps) {
  return (
    <motion.div
      key="news"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">今日輿情概覽</h2>
          <p className="text-black/40 font-medium text-sm md:text-base leading-relaxed">
            監測焦點：零售、電商、91APP、SHOPLINE、CYBERBIZ
            {lastUpdated && (
              <span className="block sm:inline">
                <span className="hidden sm:inline"> • </span>
                最後更新：{lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {disabledMediaCount > 0 && (
              <span className="block sm:inline sm:ml-2 text-brand-red">
                (已過濾 {disabledMediaCount} 個媒體)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('settings')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-apple-border/30 rounded-full text-sm font-semibold hover:bg-apple-gray transition-all active:scale-95"
          >
            <Filter className="w-4 h-4" />
            篩選媒體
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="apple-card h-48 animate-pulse bg-white/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredNews.map((item, idx) => (
            <motion.a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="apple-card group flex flex-col md:flex-row overflow-hidden"
            >
              {item.thumbnail && (
                <div className="md:w-40 h-40 md:h-auto shrink-0 overflow-hidden bg-apple-gray">
                  <img 
                    src={item.thumbnail} 
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              <div className="p-6 flex flex-col justify-between flex-1">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-brand-red/5 text-brand-red text-xs font-bold rounded-full uppercase tracking-wider">
                        {item.media}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-black/30 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold leading-snug group-hover:text-brand-red transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                </div>
                
                <div className="mt-6 flex items-center justify-end">
                  <div className="w-10 h-10 rounded-full bg-apple-gray flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      )}

      {filteredNews.length === 0 && !loading && (
        <div className="text-center py-24 apple-card">
          <Newspaper className="w-12 h-12 text-black/10 mx-auto mb-4" />
          <p className="text-black/40 font-medium">目前沒有符合條件的新聞</p>
        </div>
      )}
    </motion.div>
  );
}
