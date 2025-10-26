import winston from "winston";
import { envHelper } from "../helpers/index.mjs";

const logLevel = envHelper.getStringEnv("LOG_LEVEL", "info");

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
      const formattedTimestamp = new Date(timestamp)
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      return `[${formattedTimestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
