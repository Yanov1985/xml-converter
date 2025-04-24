import { defineEventHandler, readBody, createError } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { isVercel, getBasePath } from '../utils/environment';

// Пути к директориям
const basePath = getBasePath();
const XML_DIR = path.join(basePath, 'xml');
const CONVERTED_DIR = path.join(basePath, 'converted');

// API-обработчик для обработки XML файлов
export default defineEventHandler(async (event) => {
  try {
    // Получаем параметры запроса
    const body = await readBody(event);
    const fileName = body.filename;

    if (!fileName) {
      return createError({
        statusCode: 400,
        statusMessage: 'Не указано имя файла для обработки'
      });
    }

    // Предотвращаем path traversal атаки
    const safeFileName = path.basename(fileName);
    const xmlFilePath = path.join(XML_DIR, safeFileName);

    // Проверяем существование файла
    try {
      await fs.access(xmlFilePath);
    } catch (error) {
      return createError({
        statusCode: 404,
        statusMessage: 'XML файл не найден'
      });
    }

    // Убеждаемся, что директория для выходных файлов существует
    await fs.mkdir(CONVERTED_DIR, { recursive: true });

    // Определяем имя выходного файла без расширения
    const outputBaseName = path.join(CONVERTED_DIR, path.basename(safeFileName, '.xml'));

    // В демо-режиме Vercel создаем демо-файлы
    if (isVercel()) {
      // Создаем директорию для выходных файлов
      await fs.mkdir(CONVERTED_DIR, { recursive: true });

      // Создаем демо-файлы
      const csvContent = 'id,name,value\n1,"Демо элемент","Демо значение"';
      await fs.writeFile(`${outputBaseName}.csv`, csvContent);

      // Простой HTML-файл
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
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
      `;
      await fs.writeFile(`${outputBaseName}.html`, htmlContent);

      // Просто создаем пустой файл для Excel (без реальных данных)
      await fs.writeFile(`${outputBaseName}.xlsx`, 'Демо Excel файл');

      // Возвращаем информацию о результате операции
      return {
        success: true,
        fileName: safeFileName,
        outputFiles: {
          csv: `${outputBaseName}.csv`,
          xlsx: `${outputBaseName}.xlsx`,
          html: `${outputBaseName}.html`
        },
        convertedFiles: {
          csv: `/api/download?file=${path.basename(outputBaseName)}.csv`,
          xlsx: `/api/download?file=${path.basename(outputBaseName)}.xlsx`,
          html: `/api/download?file=${path.basename(outputBaseName)}.html`
        },
        message: 'Файл успешно обработан в демо-режиме',
        isDemo: true
      };
    }

    // В обычном режиме запускаем конвертацию
    try {
      // Путь к конвертеру относительно корня проекта
      const converterPath = path.resolve(process.cwd(), '../xml-to-csv.js');

      // Создаем промис для ожидания завершения процесса
      const conversionResult = await new Promise((resolve, reject) => {
        // Запускаем процесс конвертации
        const converter = spawn('node', [converterPath, xmlFilePath, '--output', outputBaseName]);

        let stdoutData = '';
        let stderrData = '';

        converter.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        converter.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        converter.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              stdout: stdoutData,
              outputFiles: {
                csv: `${outputBaseName}.csv`,
                xlsx: `${outputBaseName}.xlsx`,
                html: `${outputBaseName}.html`
              }
            });
          } else {
            reject({
              success: false,
              error: `Ошибка при конвертации, код ошибки: ${code}`,
              stderr: stderrData
            });
          }
        });

        // Обработка ошибок при запуске процесса
        converter.on('error', (err) => {
          reject({
            success: false,
            error: `Ошибка при запуске процесса конвертации: ${err.message}`,
          });
        });
      });

      // Получаем относительные пути к файлам для доступа через API
      const relativePaths = {
        csv: `/api/download?file=${path.basename(conversionResult.outputFiles.csv)}`,
        xlsx: `/api/download?file=${path.basename(conversionResult.outputFiles.xlsx)}`,
        html: `/api/download?file=${path.basename(conversionResult.outputFiles.html)}`
      };

      // Возвращаем информацию о результате операции
      return {
        success: true,
        fileName: safeFileName,
        outputFiles: conversionResult.outputFiles,
        convertedFiles: relativePaths,
        message: 'Файл успешно обработан',
        isDemo: false
      };
    } catch (error) {
      console.error('Ошибка при конвертации файла:', error);
      return createError({
        statusCode: 500,
        statusMessage: `Ошибка при конвертации файла: ${error.error || error.message || 'Неизвестная ошибка'}`
      });
    }
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при обработке запроса: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
