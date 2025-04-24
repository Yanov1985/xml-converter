// Эндпоинт для проверки окружения Vercel
// Определяет, работает ли приложение в среде Vercel
import { defineEventHandler } from 'h3';
import { isVercel, isProduction, isDevelopment, getRuntimeEnv } from '../utils/environment';

export default defineEventHandler(async (event) => {
  // Возвращаем информацию о текущем окружении с использованием утилит
  return {
    isVercel: isVercel(),
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),
    env: getRuntimeEnv(),
    // Другая полезная информация об окружении
    serverInfo: {
      platform: process.platform,
      nodeVersion: process.version,
    }
  };
});
