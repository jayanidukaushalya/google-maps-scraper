import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  DEFAULT_BROWSER_ARGS,
  DEFAULT_TIMEOUT,
  NETWORK_IDLE_TIMEOUT,
} from "../constants.js";
import { ScraperOptions, SearchResult } from "../types.js";
import autoScroll from "../utils/auto-scroll.js";
import buildGoogleMapsURL from "../utils/build-google-map-url.js";
import { delay } from "../utils/index.js";
import logger from "../utils/logger.js";
import generateRandomUserAgent from "./generate-random-user-agent.js";
import processSearchResult from "./process-search-result.js";

const scrapeWithoutPMap = async ({
  searchKey,
  coordinates,
  resultLimit = 10,
  email = false,
  socialLinks = false,
}: ScraperOptions): Promise<
  (SearchResult | null | undefined)[] | undefined
> => {
  puppeteer.use(StealthPlugin());

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: DEFAULT_BROWSER_ARGS,
    });

    const page = await browser.newPage();

    // Enhanced navigation and timeout protection
    const defaultTimeout =
      email || socialLinks ? DEFAULT_TIMEOUT * 2 : DEFAULT_TIMEOUT;

    page.setDefaultNavigationTimeout(defaultTimeout);
    page.setDefaultTimeout(defaultTimeout);

    await page.setUserAgent(generateRandomUserAgent());

    // Slightly randomize viewport
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
    });

    // Configure additional protections
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Enhanced anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    });

    const url = buildGoogleMapsURL({
      searchKey,
      coordinates,
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
    });

    // Add a small delay to allow page to settle
    await delay(1000 + Math.random() * 1000);

    const idleTimeout =
      email || socialLinks ? NETWORK_IDLE_TIMEOUT * 2 : NETWORK_IDLE_TIMEOUT;

    await page.waitForSelector('div[role="feed"]', {
      timeout: idleTimeout,
    });

    await autoScroll(page, resultLimit);

    const searchResultLinks: string[] = await page.evaluate((limit) => {
      const links = Array.from(
        document.querySelectorAll(
          'div[role="feed"] > div:nth-child(n+3) > div > a'
        )
      );
      return links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => href !== null)
        .slice(0, limit);
    }, resultLimit);

    logger.info(`Found ${searchResultLinks.length} search result links`);

    const searchResultData = [];

    for (let index = 0; index < searchResultLinks.length; index++) {
      const link = searchResultLinks[index];
      try {
        const result = await processSearchResult(
          page,
          link,
          email,
          socialLinks
        );
        if (result) {
          logger.info(`✅ Processed result ${index + 1}: ${result.title}`);
        }
        searchResultData.push(result);
      } catch (error) {
        logger.error(`🔍 Error processing search result ${index + 1}: `, error);
        searchResultData.push(null);
      }
    }

    return searchResultData;
  } catch (error) {
    logger.error("🌐 Scraping error: ", error);
    return;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default scrapeWithoutPMap;
