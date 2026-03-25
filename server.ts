import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Parser from "rss-parser";
import axios from "axios";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "fs/promises";

dotenv.config();
console.log("Loaded GMAIL_USER:", process.env.GMAIL_USER);

const parser = new Parser();

const SCHEDULE_FILE = path.join(process.cwd(), "schedule.json");

// Global Schedule State
let lineCronJob: cron.ScheduledTask | null = null;
let edmCronJob: cron.ScheduledTask | null = null;

let scheduleConfig = {
  lineTime: "09:00", // Default 9:00 AM
  edmTime: "09:00",  // Default 9:00 AM
  edmEmail: process.env.GMAIL_USER || "", // Default to sender email
  lineEnabled: false,
  edmEnabled: false,
  timezone: "Asia/Taipei"
};

async function loadSchedule() {
  try {
    const data = await fs.readFile(SCHEDULE_FILE, "utf-8");
    scheduleConfig = { ...scheduleConfig, ...JSON.parse(data) };
    console.log("Loaded schedule config:", scheduleConfig);
  } catch (e) {
    console.log("No existing schedule config found, using defaults.");
  }
  updateCronJobs();
}

async function saveSchedule() {
  try {
    await fs.writeFile(SCHEDULE_FILE, JSON.stringify(scheduleConfig, null, 2));
  } catch (e) {
    console.error("Failed to save schedule config:", e);
  }
}

// Media weights (Higher is better)
const MEDIA_WEIGHTS: Record<string, number> = {
  "中央社": 100,
  "中央通訊社": 100,
  "CNA": 100,
  "商業周刊": 100,
  "商周": 100,
  "Business Weekly": 100,
  "天下雜誌": 100,
  "天下": 100,
  "CommonWealth": 100,
  "數位時代": 100,
  "Business Next": 100,
  "經理人": 100,
  "Manager Today": 100,
  "工商時報": 100,
  "工商": 100,
  "Commercial Times": 100,
  "經濟日報": 100,
  "經濟": 100,
  "Economic Daily News": 100,
  "科技新報": 100,
  "Technews": 100,
};

const EXCLUDED_KEYWORDS = [
  ".hk", ".cn", ".mo", 
  "香港", "中國", "澳門", 
  "China", "Hong Kong", "Macau", "Macao",
  "網友", "驚呆", "瘋搶", "懶人包", "開箱", "試吃", "抽獎", "限時", "優惠",
  "迪士尼", "環球影城", "機票", "旅遊", "星座", "運勢", "回應了", "官方回應"
];

const STRATEGIC_KEYWORDS = [
  "獲利", "佈局", "營收", "財報", "擴店", "轉型", "策略", "併購", "投資", 
  "OMO", "數位", "虛實融合", "展店", "淨利", "成長", "市佔", "競爭",
  "加盟", "連鎖", "永續", "ESG", "人才", "培訓", "通路", "流通", "消費趨勢"
];

async function fetchAndProcessNews() {
  const keywords = ["零售", "電商", "91APP", "SHOPLINE", "CYBERBIZ"];
  let allItems: any[] = [];

  // Fetch from multiple keywords to get more variety
  const fetchPromises = keywords.map(async (keyword) => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}+when:24h&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
    try {
      const feed = await parser.parseURL(url);
      return feed.items;
    } catch (e) {
      console.error(`Error fetching ${keyword}:`, e);
      return [];
    }
  });

  const results = await Promise.all(fetchPromises);
  allItems = results.flat();

  // Process items
  const processedItems = allItems
    .map(item => {
      // Extract media name from title (Google RSS usually formats as "Title - Media")
      // Sometimes it uses " | " or " / "
      let cleanTitle = item.title;
      let mediaName = "未知媒體";

      const separators = [" - ", " | ", " / "];
      for (const sep of separators) {
        if (cleanTitle.includes(sep)) {
          const parts = cleanTitle.split(sep);
          mediaName = parts.pop()?.trim() || "未知媒體";
          cleanTitle = parts.join(sep).trim();
          break;
        }
      }
      
      // Find weight by checking if mediaName contains any of our weight keys
      let weight = 10;
      for (const [key, w] of Object.entries(MEDIA_WEIGHTS)) {
        if (mediaName.includes(key)) {
          weight = Math.max(weight, w);
        }
      }

      // Strategic keyword bonus
      for (const k of STRATEGIC_KEYWORDS) {
        if (cleanTitle.includes(k)) {
          weight += 20; // Significant boost for strategic news
          break;
        }
      }
      
      // Try to extract image from description (Google News often has an <img> tag)
      const imgMatch = item.content?.match(/<img[^>]+src="([^">]+)"/);
      const thumbnail = imgMatch ? imgMatch[1] : null;
      
      return {
        title: cleanTitle,
        link: item.link,
        pubDate: item.pubDate,
        media: mediaName,
        thumbnail,
        weight,
        guid: item.guid || item.link
      };
    })
    .filter(item => {
      // Filter out noise and irrelevant sources
      const source = item.media || "";
      const title = item.title || "";
      const link = item.link || "";
      
      // Must not contain any excluded keywords
      const hasNoise = EXCLUDED_KEYWORDS.some(k => 
        source.includes(k) || title.includes(k) || link.includes(k)
      );
      if (hasNoise) return false;

      // For general retail news, try to ensure it's somewhat relevant to business
      // If it's from a low-weight media, require at least one strategic keyword
      if (item.weight < 50) {
        return STRATEGIC_KEYWORDS.some(k => title.includes(k));
      }

      return true;
    });

  // Fuzzy deduplication
  const finalItems: any[] = [];
  
  // Sort by weight first so we keep the best source
  const sortedByWeight = [...processedItems].sort((a, b) => b.weight - a.weight);

  // Helper for Bigram similarity (Dice's Coefficient)
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const calculateSimilarity = (str1: string, str2: string) => {
    const b1 = getBigrams(str1);
    const b2 = getBigrams(str2);
    if (b1.size === 0 || b2.size === 0) return 0;
    let intersection = 0;
    for (const bg of b1) {
      if (b2.has(bg)) intersection++;
    }
    return (2.0 * intersection) / (b1.size + b2.size);
  };

  // Known retail entities to prevent false positives (e.g., "統一2月營收" vs "全家2月營收")
  const ENTITIES = ["統一", "全家", "momo", "富邦", "pchome", "網家", "蝦皮", "shopee", "酷澎", "coupang", "家樂福", "大潤發", "全聯", "新光三越", "遠百", "sogo", "寶雅", "屈臣氏", "康是美", "誠品", "微風", "好市多", "costco", "大樹", "唐吉訶德", "donki", "無印良品", "muji", "ikea"];

  for (const item of sortedByWeight) {
    const isDuplicate = finalItems.some(existing => {
      // Normalize titles: remove punctuation and spaces
      const s1 = item.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").toLowerCase();
      const s2 = existing.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").toLowerCase();
      
      if (s1 === s2) return true;

      // 1. Entity collision check: If they mention DIFFERENT specific companies, they are NOT duplicates
      const e1 = ENTITIES.filter(e => s1.includes(e));
      const e2 = ENTITIES.filter(e => s2.includes(e));
      if (e1.length > 0 && e2.length > 0) {
        const hasCommonEntity = e1.some(e => e2.includes(e));
        if (!hasCommonEntity) return false; // Different companies -> not duplicate
      }

      // 2. Specific Event Catcher: Economic Reports (e.g., "2月零售業營業額")
      const econRegex = /([1-9]|1[0-2])月.*(營業額|營收|出口|餐飲|批發|零售|景氣|cpi|通膨|統計)/;
      const match1 = s1.match(econRegex);
      const match2 = s2.match(econRegex);
      if (match1 && match2 && match1[1] === match2[1]) {
        // Both mention the same month and economic keywords -> highly likely duplicate
        return true;
      }

      // 3. Bigram Similarity Check
      // > 0.4 similarity is usually a strong indicator of the same news event in Chinese titles
      const similarity = calculateSimilarity(s1, s2);
      if (similarity > 0.4) return true;
      
      // 4. Substring overlap (fallback)
      if (s1.length > 5 && s2.length > 5) {
        const short = s1.length < s2.length ? s1 : s2;
        const long = s1.length < s2.length ? s2 : s1;
        
        const matchLen = Math.min(8, Math.floor(short.length * 0.6));
        const requiredLen = Math.max(6, matchLen);
        
        for (let i = 0; i <= short.length - requiredLen; i++) {
          const chunk = short.substring(i, i + requiredLen);
          if (long.includes(chunk)) return true;
        }
      }

      return false;
    });

    if (!isDuplicate) {
      finalItems.push(item);
    }
  }

  // Final sort by date
  return finalItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/line/push", async (req, res) => {
    try {
      const { news } = req.body;
      const LINE_ACCESS_TOKEN = "P6uZiI5KpHonlmHqGvmAvVmcl5TI5F/nF7zvlCCyriflP5/P0mvdKJI1RUn3+SCHrWQ9BMSCa4nH31TrUUeuUqc/6qAqwPNg9uQhxVGsEryaV5P94b1vSNvT2l4OFoB4NHS9kB65nlnTp19c8x74/AdB04t89/1O/w1cDnyilFU=";
      const LINE_USER_ID = "U82404d4fa54a45b5b98e59028aea7636";

      if (!LINE_ACCESS_TOKEN) {
        return res.status(400).json({ error: "LINE API keys not configured. Please set LINE_ACCESS_TOKEN in .env" });
      }

      if (!news || !Array.isArray(news) || news.length === 0) {
        return res.status(400).json({ error: "No news provided to send." });
      }

      // Date formatting for Taiwan Time (UTC+8)
      const now = new Date();
      const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const yesterdayTwTime = new Date(twTime.getTime() - 24 * 60 * 60 * 1000);

      const formatDate = (d: Date) => `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      const formatTime = (d: Date) => {
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        return `${mm}/${dd} ${hh}:${min}`;
      };

      const header = `📰 零售/電商早報 ${formatDate(twTime)}\n` +
                     `⏱️ 統計：${formatTime(yesterdayTwTime)} ~ ${formatTime(twTime)}\n` +
                     `📌 共 ${news.length} 則新聞\n` +
                     `────────────────────`;

      let textContent = `${header}\n\n`;
      let currentLength = textContent.length;

      // Only process up to 20 news items to avoid long waiting times and rate limits
      const pushNews = news.slice(0, 20);

      for (let i = 0; i < pushNews.length; i++) {
        const n = pushNews[i];
        let shortLink = n.link;
        
        try {
          // Use TinyURL API to shorten the link
          const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(n.link)}`);
          if (response.data) {
            shortLink = response.data;
          }
        } catch (e) {
          console.error("URL Shorten Error:", e);
          // Fallback to original link if shortening fails
        }

        const itemText = `${i + 1}. ${n.title}\n📰 ${n.media || "未知媒體"} ${shortLink}\n\n`;
        
        // LINE text message limit is 5000 characters. We leave a buffer of 100 characters.
        if (currentLength + itemText.length > 4900) {
          textContent += `...\n(因 LINE 字數限制，省略後續 ${news.length - i} 則新聞)`;
          break;
        }
        textContent += itemText;
        currentLength += itemText.length;
      }
      
      textContent = textContent.trim();
      
      const message = {
        to: LINE_USER_ID,
        messages: [
          {
            type: "text",
            text: textContent
          }
        ]
      };

      await axios.post('https://api.line.me/v2/bot/message/push', message, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      const errorDetail = error.response?.data?.message || error.message;
      const lineDetails = error.response?.data?.details ? JSON.stringify(error.response.data.details) : "";
      console.error("LINE Push Error:", error.response?.data || error.message);
      res.status(500).json({ error: `發送失敗: ${errorDetail} ${lineDetails}` });
    }
  });

  app.get("/api/test-env", (req, res) => {
    res.json({
      user: process.env.GMAIL_USER || "undefined",
      pass: process.env.GMAIL_APP_PASSWORD ? "set" : "undefined"
    });
  });

  app.post("/api/email/push", async (req, res) => {
    try {
      const { news, email } = req.body;
      
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return res.status(400).json({ error: "Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env" });
      }

      if (!email) {
        return res.status(400).json({ error: "No recipient email provided." });
      }

      if (!news || !Array.isArray(news) || news.length === 0) {
        return res.status(400).json({ error: "No news provided to send." });
      }

      // Format the top 10 news into an HTML EDM
      const pushNews = news.slice(0, 10);
      
      const newsHtml = pushNews.map((n: any) => `
        <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; font-family: sans-serif;">
          ${n.thumbnail ? `<a href="${n.link}" target="_blank"><img src="${n.thumbnail}" alt="Thumbnail" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin-bottom: 15px; object-fit: cover;" /></a>` : ''}
          <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #1a1a1a;">
            <a href="${n.link}" target="_blank" style="color: #1a1a1a; text-decoration: none;">${n.title}</a>
          </h2>
          <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: bold;">
            📰 ${n.media || "未知媒體"} • ${new Date(n.pubDate).toLocaleDateString()}
          </p>
          ${n.contentSnippet ? `<p style="margin: 0 0 15px 0; font-size: 15px; color: #4a4a4a; line-height: 1.5;">${n.contentSnippet.substring(0, 150)}...</p>` : ''}
          <div style="text-align: center; margin-top: 15px;">
            <a href="${n.link}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #E72410; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
              閱讀全文
            </a>
          </div>
        </div>
      `).join('');

      const htmlContent = `
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; font-family: sans-serif;">
          <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #E72410;">
            <h1 style="color: #E72410; margin: 0; font-size: 28px;">零售觀察室</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">今日零售與電商精選早報</p>
          </div>
          ${newsHtml}
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} 零售觀察室. All rights reserved.</p>
            <p>此為系統自動發送之信件，請勿直接回覆。</p>
          </div>
        </div>
      `;

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      const mailOptions = {
        from: `"零售觀察室" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `📰 零售/電商早報 ${new Date().toLocaleDateString()}`,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Email Push Error:", error);
      res.status(500).json({ error: `發送失敗: ${error.message}` });
    }
  });

  app.get("/api/schedule", (req, res) => {
    res.json(scheduleConfig);
  });

  app.post("/api/schedule", async (req, res) => {
    const { lineTime, edmTime, edmEmail, lineEnabled, edmEnabled, timezone } = req.body;
    
    if (lineTime !== undefined) scheduleConfig.lineTime = lineTime;
    if (edmTime !== undefined) scheduleConfig.edmTime = edmTime;
    if (edmEmail !== undefined) scheduleConfig.edmEmail = edmEmail;
    if (lineEnabled !== undefined) scheduleConfig.lineEnabled = lineEnabled;
    if (edmEnabled !== undefined) scheduleConfig.edmEnabled = edmEnabled;
    if (timezone !== undefined) scheduleConfig.timezone = timezone;

    await saveSchedule();
    updateCronJobs();
    res.json({ success: true, schedule: scheduleConfig });
  });

  function updateCronJobs() {
    // Stop existing jobs
    if (lineCronJob) lineCronJob.stop();
    if (edmCronJob) edmCronJob.stop();

    // Parse times (format: "HH:mm")
    const parseTime = (timeStr: string) => {
      const [hour, minute] = timeStr.split(':');
      return { hour, minute };
    };

    const cronOptions = {
      scheduled: true,
      timezone: scheduleConfig.timezone || "Asia/Taipei"
    };

    if (scheduleConfig.lineEnabled) {
      const { hour, minute } = parseTime(scheduleConfig.lineTime);
      const cronExp = `${minute} ${hour} * * *`;
      console.log(`Scheduling LINE push at ${cronExp} (${cronOptions.timezone})`);
      lineCronJob = cron.schedule(cronExp, async () => {
        console.log("Running scheduled LINE push...");
        try {
          const news = await fetchAndProcessNews();
          if (news.length === 0) return;
          
          const pushNews = news.slice(0, 10);
          const messages = pushNews.map((n: any) => ({
            type: "text",
            text: `📰 ${n.media || "未知媒體"}\n${n.title}\n${n.link}`
          }));

          await axios.post(
            "https://api.line.me/v2/bot/message/broadcast",
            { messages },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
              },
            }
          );
          console.log("Scheduled LINE push successful.");
        } catch (error) {
          console.error("Scheduled LINE push error:", error);
        }
      }, cronOptions);
    }

    if (scheduleConfig.edmEnabled && scheduleConfig.edmEmail) {
      const { hour, minute } = parseTime(scheduleConfig.edmTime);
      const cronExp = `${minute} ${hour} * * *`;
      console.log(`Scheduling EDM push at ${cronExp} (${cronOptions.timezone})`);
      edmCronJob = cron.schedule(cronExp, async () => {
        console.log("Running scheduled EDM push...");
        try {
          const news = await fetchAndProcessNews();
          if (news.length === 0) return;

          const pushNews = news.slice(0, 10);
          const newsHtml = pushNews.map((n: any) => `
            <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee; font-family: sans-serif;">
              ${n.thumbnail ? `<a href="${n.link}" target="_blank"><img src="${n.thumbnail}" alt="Thumbnail" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin-bottom: 15px; object-fit: cover;" /></a>` : ''}
              <h2 style="margin: 0 0 10px 0; font-size: 20px; color: #1a1a1a;">
                <a href="${n.link}" target="_blank" style="color: #1a1a1a; text-decoration: none;">${n.title}</a>
              </h2>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: bold;">
                📰 ${n.media || "未知媒體"} • ${new Date(n.pubDate).toLocaleDateString()}
              </p>
              ${n.contentSnippet ? `<p style="margin: 0 0 15px 0; font-size: 15px; color: #4a4a4a; line-height: 1.5;">${n.contentSnippet.substring(0, 150)}...</p>` : ''}
              <div style="text-align: center; margin-top: 15px;">
                <a href="${n.link}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #E72410; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  閱讀全文
                </a>
              </div>
            </div>
          `).join('');

          const htmlContent = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E72410; margin: 0;">零售觀察室</h1>
                <p style="color: #666; font-size: 14px; margin-top: 5px;">為您整理今日最重要的新聞</p>
              </div>
              ${newsHtml}
              <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
                <p>此信件由系統自動發送，請勿直接回覆。</p>
              </div>
            </div>
          `;

          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD,
            },
          });

          await transporter.sendMail({
            from: `"零售觀察室" <${process.env.GMAIL_USER}>`,
            to: scheduleConfig.edmEmail,
            subject: `📰 零售/電商早報 ${new Date().toLocaleDateString()}`,
            html: htmlContent,
          });
          console.log("Scheduled EDM push successful.");
        } catch (error) {
          console.error("Scheduled EDM push error:", error);
        }
      }, cronOptions);
    }
  }

  // Initialize cron jobs on startup
  loadSchedule();

  app.get("/api/cron/trigger", async (req, res) => {
    // This endpoint is for external cron services (like cron-job.org) to keep the server awake
    // or trigger jobs manually if needed.
    res.json({ status: "awake", time: new Date().toISOString() });
  });

  app.get("/api/news", async (req, res) => {
    try {
      const result = await fetchAndProcessNews();
      res.json(result);
    } catch (error) {
      console.error("RSS Fetch Error:", error);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
