import fs from "fs/promises";
import path from "path";
import scrapeWithoutPMap from "./services/scrape-without-pmap.js";
import logger from "./utils/logger.js";

const runScraper = async () => {
  try {
    // const results = await scrape({
    //   searchKey: "restaurants in Perth WA, Australia",
    //   email: true,
    //   socialLinks: true,
    //   resultLimit: 20,
    //   threadCount: 3,
    // });

    const results = await scrapeWithoutPMap({
      searchKey: "restaurants in Perth WA, Australia",
      email: true,
      socialLinks: true,
      resultLimit: 20,
    });

    if (results) {
      logger.info(`Successfully scraped ${results.length} results`);

      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), "scraper-output");
      await fs.mkdir(outputDir, { recursive: true });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const filename = `result-${timestamp}.json`;
      const filepath = path.join(outputDir, filename);

      // Write results to JSON file
      await fs.writeFile(filepath, JSON.stringify(results, null, 2));

      logger.info(`Results saved to ${filepath}`);
    } else {
      logger.warn("Scraping failed or returned no results");
    }
  } catch (error) {
    logger.error("Error running scraper:", error);
  }
};

runScraper();
