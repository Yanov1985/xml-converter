import { defineEventHandler, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { getBasePath } from '../utils/environment';

/**
 * API-эндпоинт для получения списка XML-файлов и конвертированных файлов
 *
 * Возвращает два массива:
 * 1. xml - список загруженных XML-файлов
 * 2. converted - список конвертированных файлов (CSV, Excel, HTML)
 */
export default defineEventHandler(async (event) => {
  try {
    // Определяем базовую директорию с помощью утилиты
    const basePath = getBasePath();

    // Пути к директориям
    const xmlDirPath = path.join(basePath, 'xml');
    const convertedDirPath = path.join(basePath, 'converted');

    // Создаем директории, если они не существуют
    if (!fs.existsSync(xmlDirPath)) {
      fs.mkdirSync(xmlDirPath, { recursive: true });
    }

    if (!fs.existsSync(convertedDirPath)) {
      fs.mkdirSync(convertedDirPath, { recursive: true });
    }

    // Получаем списки файлов
    const xmlFiles = getFilesInfo(xmlDirPath, '.xml', basePath);
    const convertedFiles = getConvertedFilesInfo(convertedDirPath, basePath);

    // Возвращаем результат
    return {
      xml: xmlFiles,
      converted: convertedFiles
    };

  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);

    // Возвращаем ошибку в формате, который ожидается на клиенте
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Произошла ошибка при получении списка файлов'
    });
  }
});

/**
 * Функция для получения информации о файлах в директории
 *
 * @param dirPath - путь к директории
 * @param extension - расширение файлов (с точкой, например '.xml')
 * @param basePath - базовый путь для создания относительных путей
 * @returns массив объектов с информацией о файлах
 */
function getFilesInfo(dirPath: string, extension: string, basePath: string) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  // Получаем список файлов с нужным расширением
  const files = fs.readdirSync(dirPath).filter(file => file.endsWith(extension));

  // Формируем массив с информацией о файлах
  return files.map(file => {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    return {
      name: file,
      path: path.relative(basePath, filePath).replace(/\\/g, '/'),
      size: stats.size,
      mtime: stats.mtime,
      type: extension.substring(1) // Убираем точку из расширения
    };
  });
}

/**
 * Функция для получения информации о конвертированных файлах
 *
 * @param dirPath - путь к директории с конвертированными файлами
 * @param basePath - базовый путь для создания относительных путей
 * @returns массив объектов с информацией о файлах
 */
function getConvertedFilesInfo(dirPath: string, basePath: string) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const fileTypes = ['.csv', '.xlsx', '.html'];
  const allFiles = [];

  // Получаем список всех файлов в директории
  const files = fs.readdirSync(dirPath);

  // Фильтруем файлы по поддерживаемым типам и формируем массив с информацией
  fileTypes.forEach(ext => {
    const filesOfType = files.filter(file => file.endsWith(ext));

    filesOfType.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      allFiles.push({
        name: file,
        path: path.relative(basePath, filePath).replace(/\\/g, '/'),
        size: stats.size,
        mtime: stats.mtime,
        type: ext.substring(1) // Убираем точку из расширения
      });
    });
  });

  // Сортируем файлы по времени модификации (новые в начале)
  return allFiles.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
}
