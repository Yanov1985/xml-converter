import { defineEventHandler, createError, getQuery, sendStream } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

// Путь к папке с конвертированными файлами
const isVercel = process.env.VERCEL === '1';
const OUTPUT_DIR = isVercel
  ? path.join('/tmp', 'converted')
  : path.resolve(process.cwd(), '../converted');

// API-обработчик для скачивания конвертированных файлов
export default defineEventHandler(async (event) => {
  try {
    // Получаем параметр запроса (имя файла)
    const query = getQuery(event);
    const fileName = query.file as string;

    if (!fileName) {
      return createError({
        statusCode: 400,
        statusMessage: 'Не указано имя файла'
      });
    }

    // Предотвращаем path traversal атаки
    const sanitizedFileName = path.basename(fileName);
    const filePath = path.join(OUTPUT_DIR, sanitizedFileName);

    // В Vercel среде, если это демо-режим, создаем файл на лету
    if (isVercel) {
      // Проверяем существование директории
      try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
      } catch (error) {
        console.error('Ошибка при создании директории:', error);
      }

      // Определяем тип файла и создаем демо-содержимое
      const ext = path.extname(sanitizedFileName).toLowerCase();

      if (ext === '.csv') {
        await fs.writeFile(filePath, 'id,name,price,description\n1,Демо продукт,1000,"Это демо-файл для Vercel"');
      } else if (ext === '.xlsx') {
        // Для Excel просто создаем пустой файл, т.к. мы не можем создать настоящий Excel без библиотеки
        await fs.writeFile(filePath, 'Это демо-файл Excel для Vercel');
      } else if (ext === '.html') {
        await fs.writeFile(filePath, `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Демо-файл для Vercel</title>
            <style>
              body { font-family: Arial; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Демо-таблица для Vercel</h1>
            <p>Это демонстрационный HTML-файл, сгенерированный в среде Vercel.</p>
            <table>
              <tr><th>ID</th><th>Название</th><th>Цена</th><th>Описание</th></tr>
              <tr><td>1</td><td>Демо продукт 1</td><td>1000 руб.</td><td>Описание продукта 1</td></tr>
              <tr><td>2</td><td>Демо продукт 2</td><td>2000 руб.</td><td>Описание продукта 2</td></tr>
              <tr><td>3</td><td>Демо продукт 3</td><td>3000 руб.</td><td>Описание продукта 3</td></tr>
            </table>
          </body>
          </html>
        `);
      }
    }

    // Проверяем, существует ли файл
    try {
      const fileStat = await stat(filePath);

      if (!fileStat.isFile()) {
        return createError({
          statusCode: 404,
          statusMessage: 'Файл не найден'
        });
      }
    } catch (error) {
      return createError({
        statusCode: 404,
        statusMessage: 'Файл не найден'
      });
    }

    // Определяем MIME-тип файла в зависимости от расширения
    let contentType = 'application/octet-stream';
    if (fileName.endsWith('.csv')) {
      contentType = 'text/csv';
    } else if (fileName.endsWith('.xlsx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileName.endsWith('.html')) {
      contentType = 'text/html';
    }

    // Устанавливаем заголовки ответа
    event.node.res.setHeader('Content-Type', contentType);
    event.node.res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFileName}"`);

    // Создаем поток чтения файла и отправляем файл
    const fileStream = createReadStream(filePath);
    return sendStream(event, fileStream);

  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при скачивании файла: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
