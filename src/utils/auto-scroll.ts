import { Page } from "puppeteer";

const autoScroll = async (page: Page, resultLimit: number): Promise<void> => {
  await page.evaluate(async (resultLimit) => {
    const feedSelector = 'div[role="feed"]';
    const feedElement = document.querySelector(feedSelector);

    if (!feedElement) return;

    const scrollStep = feedElement.clientHeight * 0.8;
    let currentCount = 0;
    const maxAttempts = 10;
    let attempts = 0;
    let lastHeight = feedElement.scrollHeight;

    while (currentCount < resultLimit && attempts < maxAttempts) {
      // Scroll by 80% of viewport
      feedElement.scrollBy(0, scrollStep);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newHeight = feedElement.scrollHeight;
      const results = document.querySelectorAll(
        `${feedSelector} > div:nth-child(n+3) > div > a`
      );

      currentCount = results.length;

      // If no new content loaded, increase wait time
      if (newHeight === lastHeight) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      lastHeight = newHeight;

      if (currentCount >= resultLimit) break;
    }
  }, resultLimit);
};

export default autoScroll;
