import { defineEventHandler, readBody, createError } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { isVercel, getBasePath } from '../utils/environment';

// Пути к директориям
const basePath = getBasePath();
const XML_DIR = path.join(basePath, 'xml');
const CONVERTED_DIR = path.join(basePath, 'converted');

// API-обработчик для удаления файлов
export default defineEventHandler(async (event) => {
  try {
    // В демо-режиме Vercel имитируем успешное удаление
    if (isVercel()) {
      return {
        success: true,
        message: 'Файл успешно удален в демо-режиме',
        isDemo: true
      };
    }

    // Получаем параметры запроса
    const body = await readBody(event);
    const filePath = body.filePath;

    if (!filePath) {
      return createError({
        statusCode: 400,
        statusMessage: 'Не указан путь к файлу для удаления'
      });
    }

    // Проверяем, что путь находится в разрешенных директориях для предотвращения атак
    const normalizedPath = path.normalize(filePath);

    // Проверяем, относится ли файл к XML директории или директории конвертированных файлов
    if (!normalizedPath.startsWith(XML_DIR) && !normalizedPath.startsWith(CONVERTED_DIR)) {
      return createError({
        statusCode: 403,
        statusMessage: 'Доступ к указанному файлу запрещен'
      });
    }

    // Проверяем существование файла
    try {
      await fs.access(normalizedPath);
    } catch (error) {
      // Файл не существует, но мы это не рассматриваем как ошибку
      return {
        success: true,
        message: 'Файл уже удален или не существует',
        notFound: true
      };
    }

    // Получаем базовое имя файла для поиска связанных файлов
    const fileBaseName = path.basename(normalizedPath, path.extname(normalizedPath));
    const fileDir = path.dirname(normalizedPath);

    // Если удаляется XML файл, удаляем также связанные конвертированные файлы
    if (normalizedPath.toLowerCase().endsWith('.xml') && fileDir === XML_DIR) {
      try {
        // Ищем все связанные файлы в директории CONVERTED_DIR
        const fileExtensions = ['.csv', '.xlsx', '.html'];

        for (const ext of fileExtensions) {
          const relatedFilePath = path.join(CONVERTED_DIR, `${fileBaseName}${ext}`);
          try {
            await fs.unlink(relatedFilePath);
            console.log(`Удален связанный файл: ${relatedFilePath}`);
          } catch (error) {
            // Игнорируем ошибки, если файлы не существуют
            console.log(`Связанный файл не найден: ${relatedFilePath}`);
          }
        }
      } catch (error) {
        console.error('Ошибка при удалении связанных файлов:', error);
      }
    }

    // Удаляем файл
    await fs.unlink(normalizedPath);

    return {
      success: true,
      message: 'Файл успешно удален',
      filePath: normalizedPath,
      fileName: path.basename(normalizedPath)
    };
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при удалении файла: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
