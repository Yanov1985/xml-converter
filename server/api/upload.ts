import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { isVercel, getBasePath } from '../utils/environment';

// Пути для хранения файлов
const basePath = getBasePath();
const TEMP_UPLOAD_DIR = path.join(basePath, 'xml');
const OUTPUT_DIR = path.join(basePath, 'converted');

// Проверяем/создаем директории
async function ensureDirsExist() {
  try {
    await fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    return true;
  } catch (error) {
    console.error('Ошибка при создании директорий:', error);
    return false;
  }
}

// API-обработчик для загрузки XML файлов
export default defineEventHandler(async (event) => {
  try {
    // Убеждаемся, что директории существуют
    const dirsExist = await ensureDirsExist();
    if (!dirsExist) {
      return createError({
        statusCode: 500,
        statusMessage: 'Ошибка при создании директорий для файлов'
      });
    }

    // Получаем данные формы с файлом
    const formData = await readMultipartFormData(event);
    if (!formData || formData.length === 0) {
      return createError({
        statusCode: 400,
        statusMessage: 'Файл не был загружен'
      });
    }

    // Ищем файл в данных формы
    const fileField = formData.find(field => field.name === 'file' || field.name === 'xmlFile');
    if (!fileField || !fileField.filename) {
      return createError({
        statusCode: 400,
        statusMessage: 'XML-файл не найден в запросе'
      });
    }

    // Проверяем тип файла
    if (!fileField.filename.toLowerCase().endsWith('.xml')) {
      return createError({
        statusCode: 400,
        statusMessage: 'Загруженный файл не является XML файлом'
      });
    }

    // Генерируем уникальное имя файла для предотвращения конфликтов
    const uniqueId = randomUUID();
    const originalFilename = fileField.filename;
    const safeFilename = `${uniqueId}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // В демо-режиме Vercel создаем фиктивный XML-файл
    let filePath;
    try {
      // Создаем директорию, если ее нет
      await fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true });

      if (isVercel()) {
        // Создаем корректный XML файл вместо загруженного
        filePath = path.join(TEMP_UPLOAD_DIR, safeFilename);
        const demoXml = '<?xml version="1.0" encoding="UTF-8"?>\n<root><item>Демо-данные для Vercel</item></root>';
        await fs.writeFile(filePath, demoXml, 'utf8');
      } else {
        // В обычном режиме сохраняем загруженный файл
        filePath = path.join(TEMP_UPLOAD_DIR, safeFilename);
        await fs.writeFile(filePath, fileField.data);
      }
    } catch (error) {
      console.error('Ошибка при сохранении файла:', error);
      return createError({
        statusCode: 500,
        statusMessage: `Ошибка при сохранении файла: ${error.message}`
      });
    }

    // Определяем имя выходного файла без расширения
    const outputBaseName = path.join(OUTPUT_DIR, path.basename(safeFilename, '.xml'));

    // В демо-режиме Vercel создаем демо-файлы
    if (isVercel()) {
      // Создаем директорию для выходных файлов
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

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
        originalFilename,
        fileSize: fileField.data.length,
        filePath: filePath,
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
        message: 'Файл успешно загружен и обработан в демо-режиме',
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
        const converter = spawn('node', [converterPath, filePath, '--output', outputBaseName]);

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
        originalFilename,
        fileSize: fileField.data.length,
        filePath: filePath,
        outputFiles: conversionResult.outputFiles,
        convertedFiles: relativePaths,
        message: 'Файл успешно загружен и обработан',
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
    console.error('Ошибка при обработке загрузки:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при обработке файла: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
