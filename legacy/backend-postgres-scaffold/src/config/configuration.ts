export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localPath: process.env.STORAGE_LOCAL_PATH ?? './storage',
  },
  ai: {
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
    internalKey: process.env.INTERNAL_API_KEY,
  },
  uploads: {
    maxBytes: parseInt(process.env.MAX_UPLOAD_MB ?? '20', 10) * 1024 * 1024,
  },
});
