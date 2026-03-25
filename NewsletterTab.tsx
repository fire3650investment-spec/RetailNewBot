import { motion } from 'motion/react';
import { Send, Mail } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ScheduleConfig } from '../types';

interface NewsletterTabProps {
  handleSendLine: () => void;
  sendingLine: boolean;
  lineStatus: 'idle' | 'success' | 'error';
  lineError: string;
  filteredNewsLength: number;
  scheduleConfig: ScheduleConfig;
  setScheduleConfig: (config: ScheduleConfig) => void;
  handleSaveSchedule: () => void;
  scheduleStatus: 'idle' | 'saving' | 'success' | 'error';
  emailAddress: string;
  setEmailAddress: (email: string) => void;
  handleSendEmail: () => void;
  sendingEmail: boolean;
  emailStatus: 'idle' | 'success' | 'error';
  emailError: string;
}

export function NewsletterTab({
  handleSendLine, sendingLine, lineStatus, lineError, filteredNewsLength,
  scheduleConfig, setScheduleConfig, handleSaveSchedule, scheduleStatus,
  emailAddress, setEmailAddress, handleSendEmail, sendingEmail, emailStatus, emailError
}: NewsletterTabProps) {
  return (
    <motion.div
      key="newsletter"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto py-12 px-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LINE Push Card */}
        <div className="apple-card p-8 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-[#00B900]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#00B900]/20">
            <Send className="w-10 h-10 text-[#00B900]" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">LINE 官方帳號推播</h2>
          <p className="text-black/40 text-sm mb-8 flex-1">
            將今日最新的零售輿情摘要，直接推播至指定的 LINE 聊天室或群組。
            <span className="text-xs mt-2 block">
              * 需於後端設定 LINE_ACCESS_TOKEN 與 LINE_USER_ID
            </span>
          </p>
          <button 
            onClick={handleSendLine}
            disabled={sendingLine || filteredNewsLength === 0}
            className={cn(
              "apple-button w-full py-3 transition-all",
              lineStatus === 'success' ? "bg-green-500 text-white" :
              lineStatus === 'error' ? "bg-red-500 text-white" :
              "bg-[#00B900] text-white hover:bg-[#009900]",
              (sendingLine || filteredNewsLength === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            {sendingLine ? "發送中..." : 
             lineStatus === 'success' ? "發送成功！" : 
             lineStatus === 'error' ? "發送失敗" : 
             "立即發送至 LINE"}
          </button>
          {lineStatus === 'error' && lineError && (
            <p className="text-red-500 text-xs mt-3 font-medium">
              {lineError}
            </p>
          )}

          {/* LINE Schedule Settings */}
          <div className="w-full mt-6 pt-6 border-t border-apple-border/30 text-left">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-black/70 flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={scheduleConfig.lineEnabled}
                  onChange={(e) => setScheduleConfig({...scheduleConfig, lineEnabled: e.target.checked})}
                  className="w-4 h-4 rounded border-apple-border text-[#00B900] focus:ring-[#00B900]"
                />
                啟用定時排程
              </label>
            </div>
            {scheduleConfig.lineEnabled && (
              <div className="flex items-center gap-3">
                <input 
                  type="time" 
                  value={scheduleConfig.lineTime}
                  onChange={(e) => setScheduleConfig({...scheduleConfig, lineTime: e.target.value})}
                  className="flex-1 px-3 py-2 bg-apple-gray/50 border border-apple-border/30 rounded-lg text-sm focus:ring-2 focus:ring-[#00B900]/30 outline-none transition-all"
                />
                <button 
                  onClick={handleSaveSchedule}
                  disabled={scheduleStatus === 'saving'}
                  className="text-xs px-4 py-2.5 bg-black text-white rounded-lg hover:bg-black/80 transition-all whitespace-nowrap"
                >
                  {scheduleStatus === 'saving' ? '儲存中...' : scheduleStatus === 'success' ? '已儲存' : '儲存設定'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Email EDM Card */}
        <div className="apple-card p-8 text-center flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-brand-red/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-brand-red/20">
            <Mail className="w-10 h-10 text-brand-red" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">發送電子報 (EDM)</h2>
          <p className="text-black/40 text-sm mb-6 flex-1">
            將今日新聞整理成精美的 EDM 格式寄送至指定信箱。包含縮圖、摘要與閱讀按鈕。
          </p>
          
          <div className="w-full space-y-3">
            <input 
              type="email" 
              placeholder="輸入收件人 Email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border/30 rounded-xl text-sm focus:ring-2 focus:ring-brand-red/30 outline-none transition-all"
            />
            <button 
              onClick={handleSendEmail}
              disabled={sendingEmail || filteredNewsLength === 0 || !emailAddress}
              className={cn(
                "apple-button w-full py-3 transition-all",
                emailStatus === 'success' ? "bg-green-500 text-white" :
                emailStatus === 'error' ? "bg-red-500 text-white" :
                "bg-brand-red text-white hover:bg-brand-red/90",
                (sendingEmail || filteredNewsLength === 0 || !emailAddress) && "opacity-50 cursor-not-allowed"
              )}
            >
              {sendingEmail ? "發送中..." : 
               emailStatus === 'success' ? "發送成功！" : 
               emailStatus === 'error' ? "發送失敗" : 
               "發送電子報"}
            </button>
          </div>
          {emailStatus === 'error' && emailError && (
            <p className="text-red-500 text-xs mt-3 font-medium">
              {emailError}
            </p>
          )}

          {/* EDM Schedule Settings */}
          <div className="w-full mt-6 pt-6 border-t border-apple-border/30 text-left">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-black/70 flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={scheduleConfig.edmEnabled}
                  onChange={(e) => setScheduleConfig({...scheduleConfig, edmEnabled: e.target.checked})}
                  className="w-4 h-4 rounded border-apple-border text-brand-red focus:ring-brand-red"
                />
                啟用定時排程
              </label>
            </div>
            {scheduleConfig.edmEnabled && (
              <div className="space-y-3">
                <input 
                  type="email" 
                  placeholder="排程收件人 Email"
                  value={scheduleConfig.edmEmail}
                  onChange={(e) => setScheduleConfig({...scheduleConfig, edmEmail: e.target.value})}
                  className="w-full px-3 py-2 bg-apple-gray/50 border border-apple-border/30 rounded-lg text-sm focus:ring-2 focus:ring-brand-red/30 outline-none transition-all"
                />
                <div className="flex items-center gap-3">
                  <input 
                    type="time" 
                    value={scheduleConfig.edmTime}
                    onChange={(e) => setScheduleConfig({...scheduleConfig, edmTime: e.target.value})}
                    className="flex-1 px-3 py-2 bg-apple-gray/50 border border-apple-border/30 rounded-lg text-sm focus:ring-2 focus:ring-brand-red/30 outline-none transition-all"
                  />
                  <button 
                    onClick={handleSaveSchedule}
                    disabled={scheduleStatus === 'saving'}
                    className="text-xs px-4 py-2.5 bg-black text-white rounded-lg hover:bg-black/80 transition-all whitespace-nowrap"
                  >
                    {scheduleStatus === 'saving' ? '儲存中...' : scheduleStatus === 'success' ? '已儲存' : '儲存設定'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
