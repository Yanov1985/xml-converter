/**
 * Утилиты для определения среды выполнения приложения
 */

/**
 * Проверяет, запущено ли приложение в среде Vercel
 *
 * @returns true, если приложение запущено в Vercel, иначе false
 */
export function isVercel(): boolean {
  return process.env.VERCEL === '1';
}

/**
 * Проверяет, запущено ли приложение в production-режиме
 *
 * @returns true, если приложение запущено в production, иначе false
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Проверяет, запущено ли приложение в development-режиме
 *
 * @returns true, если приложение запущено в development, иначе false
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Возвращает имя текущего окружения
 * @returns {string} Название текущего окружения (development, production, vercel)
 */
export function getEnvironmentName(): string {
  if (isVercel()) return 'vercel';
  if (isProduction()) return 'production';
  return 'development';
}

/**
 * Получает базовый путь для хранения файлов в зависимости от среды выполнения
 *
 * @returns путь к директории для хранения файлов
 */
export function getBasePath(): string {
  if (isVercel()) {
    // В Vercel используем временную директорию
    return '/tmp';
  }

  // В локальной разработке используем текущую директорию проекта
  return process.cwd();
}
