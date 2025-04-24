import { defineEventHandler, createError, getQuery, sendStream } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { isVercel, getBasePath } from '../utils/environment';

// Пути к директориям
const basePath = getBasePath();
const XML_DIR = path.join(basePath, 'xml');
const CONVERTED_DIR = path.join(basePath, 'converted');

// API-обработчик для скачивания файлов
export default defineEventHandler(async (event) => {
  try {
    // Получаем параметры запроса
    const query = getQuery(event);
    let filePath = query.filePath as string;
    let fileName = query.file as string;

    // Проверяем, что указан путь к файлу или имя файла
    if (!filePath && !fileName) {
      return createError({
        statusCode: 400,
        statusMessage: 'Не указан путь к файлу или имя файла'
      });
    }

    // Если указано только имя файла, пытаемся найти его в директориях
    if (!filePath && fileName) {
      // Предотвращаем path traversal атаки
      fileName = path.basename(fileName);

      // Проверяем в директории конвертированных файлов
      const convertedPath = path.join(CONVERTED_DIR, fileName);
      try {
        await fs.access(convertedPath);
        filePath = convertedPath;
      } catch {
        // Проверяем в директории исходных файлов
        const xmlPath = path.join(XML_DIR, fileName);
        try {
          await fs.access(xmlPath);
          filePath = xmlPath;
        } catch {
          // Файл не найден в обеих директориях
        }
      }
    }

    // В демо-режиме Vercel создаем демо-файлы на лету
    if (isVercel()) {
      if (!fileName && filePath) {
        fileName = path.basename(filePath);
      }

      // Предотвращаем path traversal атаки
      fileName = path.basename(fileName || '');

      if (!fileName) {
        return createError({
          statusCode: 400,
          statusMessage: 'Не удалось определить имя файла'
        });
      }

      // Определяем директорию для файла
      let outputDir = CONVERTED_DIR;
      if (fileName.toLowerCase().endsWith('.xml')) {
        outputDir = XML_DIR;
      }

      // Создаем директорию, если не существует
      await fs.mkdir(outputDir, { recursive: true });

      // Полный путь к файлу
      filePath = path.join(outputDir, fileName);

      // Определяем тип файла и создаем демо-содержимое
      const ext = path.extname(fileName).toLowerCase();

      // Создаем демо-файл в зависимости от типа
      if (ext === '.csv') {
        await fs.writeFile(filePath, 'id,name,value\n1,"Демо элемент","Демо значение"');
      } else if (ext === '.xlsx') {
        // Просто пустой файл для демонстрации
        await fs.writeFile(filePath, 'Демо Excel файл');
      } else if (ext === '.html') {
        await fs.writeFile(filePath, `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Демо XML в HTML</title>
            <style>
              body { font-family: Arial; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Демо-таблица</h1>
            <table>
              <tr><th>ID</th><th>Название</th><th>Значение</th></tr>
              <tr><td>1</td><td>Демо элемент</td><td>Демо значение</td></tr>
            </table>
          </body>
          </html>
        `);
      } else if (ext === '.xml') {
        await fs.writeFile(filePath, '<?xml version="1.0" encoding="UTF-8"?>\n<root><item>Демо-данные для Vercel</item></root>');
      } else {
        await fs.writeFile(filePath, 'Демо файл');
      }
    }

    // Проверяем, существует ли файл после всех попыток его найти или создать
    if (!filePath) {
      return createError({
        statusCode: 404,
        statusMessage: 'Файл не найден'
      });
    }

    try {
      const fileStat = await stat(filePath);

      if (!fileStat.isFile()) {
        return createError({
          statusCode: 404,
          statusMessage: 'По указанному пути не найден файл'
        });
      }
    } catch (error) {
      return createError({
        statusCode: 404,
        statusMessage: 'Файл не найден или недоступен'
      });
    }

    // Если имя файла не определено, используем basename от пути
    if (!fileName) {
      fileName = path.basename(filePath);
    }

    // Определяем MIME-тип в зависимости от расширения файла
    let contentType = 'application/octet-stream';
    const extension = path.extname(fileName).toLowerCase();

    if (extension === '.csv') {
      contentType = 'text/csv';
    } else if (extension === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (extension === '.html') {
      contentType = 'text/html';
    } else if (extension === '.xml') {
      contentType = 'application/xml';
    }

    // Устанавливаем заголовки ответа
    event.node.res.setHeader('Content-Type', contentType);

    // Для файлов, которые должны скачиваться, а не открываться в браузере
    if (extension !== '.html') {
      event.node.res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    // Отправляем файл
    return sendStream(event, createReadStream(filePath));
  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при скачивании файла: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
