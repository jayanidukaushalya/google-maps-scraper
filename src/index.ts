import fs from "fs/promises";
import path from "path";
import scrapeWithoutPMap from "./services/scrape-without-pmap.js";
import logger from "./utils/logger.js";
import { createObjectCsvWriter } from "csv-writer";
import { SOCIAL_PLATFORMS } from "./constants.js";

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
      const jsonFilename = `result-${timestamp}.json`;
      const jsonFilepath = path.join(outputDir, jsonFilename);

      // Write results to JSON file
      await fs.writeFile(jsonFilepath, JSON.stringify(results, null, 2));

      logger.info(`Results saved to ${jsonFilepath}`);

      // Write results to CSV file
      const csvFilename = `result-${timestamp}.csv`;
      const csvFilepath = path.join(outputDir, csvFilename);

      // Determine common headers
      const commonHeaders = results[0]
        ? Object.keys(results[0]).filter((key) => key !== "socialLinks")
        : [];

      // Determine social headers
const socialHeaders = SOCIAL_PLATFORMS.filter((platform) => 
results.some((result) => (result?.socialLinks?.[platform.name]?.length ?? 0) > 0)).map((platform) => platform.name);

      const csvHeaders = [
        ...commonHeaders.map((key) => ({ id: key, title: key })),
        ...socialHeaders.map((platform) => ({ id: platform, title: platform })),
      ];

      const csvWriter = createObjectCsvWriter({
        path: csvFilepath,
        header: csvHeaders,
      });

      // Prepare records for CSV
      const records = results.map((result) => {
        const flattenedResult: any = { ...result };

        // Flatten socialLinks into individual columns
        socialHeaders.forEach((platform) => {
          const links = result?.socialLinks?.[platform] || [];
          flattenedResult[platform] = links.join(", "); // Join multiple links with a comma
        });

        return flattenedResult;
      });

      // Write records to CSV
      await csvWriter.writeRecords(records);
      logger.info(`Results saved to ${csvFilepath}`);
    } else {
      logger.warn("No valid data to write to CSV file");
    }
  } catch (error) {
    logger.error("Error running scraper:", error);
  }
};

runScraper();
