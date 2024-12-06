import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "scraper.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export default logger;
