import { Places } from "./constants";

export interface ScraperOptions {
  searchKey: string | Places;
  coordinates?: { latitude: number; longitude: number };
  resultLimit?: number;
  email?: boolean;
  socialLinks?: boolean;
  threadCount?: number;
}

export interface SearchResult {
  title: string | null;
  type: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  email?: string | null;
  socialLinks?: SocialLinks;
}

export interface SocialLinks {
  Facebook?: string[];
  Twitter?: string[];
  LinkedIn?: string[];
  Instagram?: string[];
  YouTube?: string[];
  TikTok?: string[];
  Pinterest?: string[];
  Snapchat?: string[];
  Reddit?: string[];
  Tumblr?: string[];
  WhatsApp?: string[];
  Vimeo?: string[];
  Discord?: string[];
  Spotify?: string[];
  Medium?: string[];
  Behance?: string[];
  Flickr?: string[];
  Twitch?: string[];
  Periscope?: string[];
  Skype?: string[];
}

export interface SocialPlatform {
  name: keyof SocialLinks;
  regex: RegExp;
}
