import { createError, defineEventHandler } from 'h3';
import fs from 'fs';
import path from 'path';
import { isVercel } from '../utils/environment';

// Определяем базовые директории в зависимости от окружения (Vercel или локальное)
const basePath = isVercel()
  ? '/tmp'
  : path.resolve(process.cwd());

// Путь к директории XML-файлов
const xmlDirPath = path.join(basePath, 'xml');
// Путь к директории конвертированных файлов
const convertedDirPath = path.join(basePath, 'converted');

/**
 * Интерфейс для описания информации о файле
 */
interface FileInfo {
  name: string;       // Имя файла
  path: string;       // Путь к файлу
  size: number;       // Размер файла в байтах
  mtime: Date;        // Дата последнего изменения
  isDirectory: boolean; // Флаг, указывающий является ли это директорией
  type?: string;      // Тип файла (xml, csv, xlsx, html)
}

/**
 * Получение информации о файле
 * @param filePath Путь к файлу
 * @param baseDirPath Базовая директория для получения относительного пути
 * @returns Объект с информацией о файле
 */
function getFileInfo(filePath: string, baseDirPath: string): FileInfo {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return {
    name: path.basename(filePath),
    path: path.relative(baseDirPath, filePath).replace(/\\/g, '/'),
    size: stats.size,
    mtime: stats.mtime,
    isDirectory: stats.isDirectory(),
    type: ext || undefined
  };
}

/**
 * Рекурсивное получение всех файлов из директории
 * @param dirPath Путь к директории
 * @param baseDirPath Базовая директория для получения относительного пути
 * @returns Массив с информацией о файлах
 */
function getFilesRecursively(dirPath: string, baseDirPath: string): FileInfo[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let files: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Рекурсивно получаем файлы из поддиректорий
        files = [...files, ...getFilesRecursively(fullPath, baseDirPath)];
      } else {
        files.push(getFileInfo(fullPath, baseDirPath));
      }
    }

    return files;
  } catch (error) {
    console.error(`Ошибка при чтении директории ${dirPath}:`, error);
    return [];
  }
}

/**
 * Создание демо-файлов для Vercel-окружения
 */
function createDemoFiles() {
  // Создаем демо XML-файл, если он не существует
  const demoXmlPath = path.join(xmlDirPath, 'demo.xml');
  if (!fs.existsSync(demoXmlPath)) {
    fs.writeFileSync(demoXmlPath, '<root><item><name>Demo Item</name><value>123</value></item></root>');
  }

  // Создаем демо-файлы конвертации, если они не существуют
  const demoTypes = ['csv', 'xlsx', 'html'];
  for (const type of demoTypes) {
    const demoPath = path.join(convertedDirPath, `demo.${type}`);
    if (!fs.existsSync(demoPath)) {
      fs.writeFileSync(demoPath, `Demo ${type.toUpperCase()} content`);
    }
  }
}

export default defineEventHandler(async (event) => {
  try {
    // Создаем директории, если они не существуют
    if (!fs.existsSync(xmlDirPath)) {
      fs.mkdirSync(xmlDirPath, { recursive: true });
    }

    if (!fs.existsSync(convertedDirPath)) {
      fs.mkdirSync(convertedDirPath, { recursive: true });
    }

    // В Vercel окружении создаем демо-файлы
    if (isVercel()) {
      createDemoFiles();
    }

    // Получаем файлы из обеих директорий
    const xmlFiles = getFilesRecursively(xmlDirPath, basePath);
    const convertedFiles = getFilesRecursively(convertedDirPath, basePath);

    // Объединяем и сортируем файлы:
    // 1. Сначала XML-файлы
    // 2. Затем остальные файлы, отсортированные по дате изменения (новые сверху)
    const allFiles = [...xmlFiles, ...convertedFiles].sort((a, b) => {
      // Сначала показываем XML-файлы
      if (a.type === 'xml' && b.type !== 'xml') return -1;
      if (a.type !== 'xml' && b.type === 'xml') return 1;

      // Затем сортируем по дате изменения (новые сверху)
      return b.mtime.getTime() - a.mtime.getTime();
    });

    // Возвращаем информацию о файлах
    return {
      isDemo: isVercel(),
      files: allFiles
    };
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    throw createError({
      statusCode: 500,
      message: `Не удалось получить список файлов: ${error.message}`
    });
  }
});
