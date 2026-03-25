export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  media: string;
  weight: number;
  thumbnail?: string;
}

export interface ScheduleConfig {
  lineTime: string;
  edmTime: string;
  edmEmail: string;
  lineEnabled: boolean;
  edmEnabled: boolean;
  timezone: string;
}
