export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appName: process.env.APP_NAME ?? 'Storage Platform',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  port: parseInt(process.env.BACKEND_PORT ?? '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    refreshExpiresInRemember: process.env.JWT_REFRESH_EXPIRES_IN_REMEMBER ?? '30d',
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
    region: process.env.S3_REGION ?? 'garage',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },
  garage: {
    adminEndpoint: process.env.GARAGE_ADMIN_ENDPOINT ?? 'http://localhost:3903',
    adminToken: process.env.GARAGE_ADMIN_TOKEN,
  },
  credentials: {
    encryptionKey: process.env.CREDENTIALS_ENCRYPTION_KEY,
  },
  files: {
    softDeleteEnabled: process.env.FILE_SOFT_DELETE_ENABLED !== 'false',
    maxUploadBytes: parseInt(process.env.UPLOAD_MAX_BYTES ?? String(100 * 1024 * 1024), 10),
    allowedExtensions: (process.env.UPLOAD_ALLOWED_EXTENSIONS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_MIME_TYPES ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    defaultBucket: process.env.FILE_DEFAULT_BUCKET ?? undefined,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'noreply@storage.local',
  },
});
