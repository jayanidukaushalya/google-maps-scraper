import retry from "async-retry";
import fs from "fs";
import path from "path";
import { Page } from "puppeteer";
import {
  DEFAULT_TIMEOUT,
  EMAIL_REGEX,
  NETWORK_IDLE_TIMEOUT,
  RETRY_LIMIT,
  SOCIAL_PLATFORMS,
} from "../constants.js";
import { SearchResult, SocialLinks } from "../types.js";
import { delay, waitSafely } from "../utils/index.js";
import logger from "../utils/logger.js";

const processSearchResult = async (
  page: Page,
  link: string,
  email: boolean,
  socialLinks: boolean
): Promise<SearchResult | undefined> => {
  return retry(
    async (bail) => {
      try {
        await page.goto(link, {
          waitUntil: "networkidle0",
        });

        // Random delay to appear more human-like
        await delay(1000 + Math.random() * 1000);

        // More resilient selector waiting
        const idleTimeout =
          email || socialLinks
            ? NETWORK_IDLE_TIMEOUT * 2
            : NETWORK_IDLE_TIMEOUT;

        await Promise.race([
          page.waitForSelector('div[role="main"]', {
            timeout: idleTimeout,
          }),
          page.waitForSelector("body", { timeout: idleTimeout }),
        ]);

        const result: SearchResult = await page.evaluate(() => {
          const selectTextContent = (selectors: string[]) => {
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element) return element.textContent?.trim() ?? null;
            }
            return null;
          };

          const titleSelectors = [
            'div[role="main"] > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(1) > h1',
            "h1.title",
            "h1",
          ];

          return {
            title: selectTextContent(titleSelectors),
            type: selectTextContent([
              'div[role="main"] > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(2) > span:nth-child(1) > span > button',
              ".business-type",
            ]),
            address: selectTextContent([
              'button[data-tooltip="Copy address"] > div > div:nth-child(2) > div:nth-child(1)',
              ".address",
            ]),
            phone: selectTextContent([
              'button[data-tooltip="Copy phone number"] > div > div:nth-child(2) > div:nth-child(1)',
              ".phone-number",
            ]),
            website:
              document
                .querySelector('a[data-tooltip="Open website"]')
                ?.getAttribute("href")
                ?.trim() ?? null,
            rating: (() => {
              const ratingElement = document.querySelector(
                'div[role="main"] > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > span:nth-child(1) > span:nth-child(1)'
              );
              return ratingElement?.textContent
                ? Number(ratingElement.textContent.trim())
                : null;
            })(),
            reviewCount: (() => {
              const reviewElement = document.querySelector(
                'div[role="main"] > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > span:nth-child(2) > span > span'
              );
              return reviewElement?.textContent
                ? Number(reviewElement.textContent.trim().replace(/[(),]/g, ""))
                : null;
            })(),
          };
        });

        // robust title validation
        if (!result.title) {
          const screenshotsDir = path.resolve("debug_screenshots");
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }

          await page.screenshot({
            path: `debug_screenshots/failed_${Date.now()}.png`,
          });

          throw new Error(
            "No title found - possible captcha, block, or page structure change"
          );
        }

        // Website data extraction
        if (result.website && (email || socialLinks)) {
          await page.goto(result.website, {
            waitUntil: ["networkidle0", "domcontentloaded"],
            timeout: DEFAULT_TIMEOUT,
          });

          // Allow dynamic content to load
          await waitSafely(1000 + Math.random() * 1000);

          const extractedData = await page.evaluate(
            (
              emailOption,
              socialLinksOption,
              emailRegexSource,
              platformSources
            ) => {
              const emailRegex = new RegExp(emailRegexSource, "i");
              const platforms = platformSources.map((platform) => ({
                ...platform,
                regex: new RegExp(platform.regex, "i"),
              }));

              let matchedEmails: string[] = [];
              let mailtoLinks: (string | undefined)[] = [];

              if (emailOption) {
                const textContent = document.body.innerText;
                matchedEmails = RegExp(emailRegex).exec(textContent) ?? [];

                // Check for emails in "mailto:" links
                mailtoLinks = Array.from(
                  document.querySelectorAll('a[href^="mailto:"]')
                ).map((link) =>
                  link.getAttribute("href")?.replace("mailto:", "").trim()
                );
              }

              const socialLinks: SocialLinks = {};

              if (socialLinksOption) {
                const anchorTags = Array.from(
                  document.querySelectorAll<HTMLAnchorElement>("a[href]")
                );

                platforms.forEach((platform) => {
                  const platformLinks = anchorTags
                    .map((anchor) => anchor.getAttribute("href")?.trim() ?? "")
                    .filter((href) => platform.regex.test(href));

                  // Remove duplicate links
                  const uniqueLinks = Array.from(new Set(platformLinks));

                  if (uniqueLinks.length > 0) {
                    socialLinks[platform.name] = platformLinks;
                  }
                });
              }

              return {
                email: emailOption
                  ? [...new Set([...matchedEmails, ...mailtoLinks])][0] ?? null
                  : undefined,
                socialLinks: socialLinksOption ? socialLinks : undefined,
              };
            },
            email,
            socialLinks,
            EMAIL_REGEX.source,
            SOCIAL_PLATFORMS.map((platform) => ({
              ...platform,
              regex: platform.regex.source,
            }))
          );

          result.email = extractedData.email;
          result.socialLinks = extractedData.socialLinks;
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes("net::ERR_")) {
            logger.warn(`Network error for ${link}: ${error.message}`);
            throw error;
          } else {
            logger.warn(`Processing error for ${link}:`, error);
          }
        } else {
          logger.warn("An unknown error occurred:", error);
        }
      }
    },
    {
      retries: RETRY_LIMIT,
      factor: 2,
      minTimeout: DEFAULT_TIMEOUT,
      maxTimeout: NETWORK_IDLE_TIMEOUT,
      onRetry: (error, attempt) => {
        const remainingRetries = RETRY_LIMIT - attempt;

        if (remainingRetries > 0) {
          // Log a warning if retries are available
          if (error instanceof Error) {
            logger.warn(
              `🔃 Retrying link ${link} due to error: ${error.message}. Retries left: ${remainingRetries}`
            );
          } else {
            logger.warn(`🔃 Retrying link. Retries left: ${remainingRetries}`);
          }
        }
      },
    }
  );
};

export default processSearchResult;
