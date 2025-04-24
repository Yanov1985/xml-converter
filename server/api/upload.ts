import { defineEventHandler, readMultipartFormData, readBody, createError } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

// Пути для хранения файлов (в Vercel используем tmp директорию)
const isVercel = process.env.VERCEL === '1';
const TEMP_UPLOAD_DIR = isVercel
  ? path.join('/tmp', 'xml')
  : path.resolve(process.cwd(), '../xml');
const OUTPUT_DIR = isVercel
  ? path.join('/tmp', 'converted')
  : path.resolve(process.cwd(), '../converted');

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

// Функция для выполнения конвертации
async function convertXmlFile(xmlFilePath: string, outputBaseName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (isVercel) {
      // В среде Vercel мы не можем запускать внешние процессы
      // Поэтому эмулируем успешную конвертацию для демонстрации
      setTimeout(() => {
        resolve({
          success: true,
          outputFiles: {
            csv: `${outputBaseName}.csv`,
            xlsx: `${outputBaseName}.xlsx`,
            html: `${outputBaseName}.html`
          },
          stdout: "Файл сконвертирован в демо-режиме на Vercel"
        });
      }, 1500);
      return;
    }

    // Путь к конвертеру относительно корня проекта
    const converterPath = path.resolve(process.cwd(), '../xml-to-csv.js');

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
          outputFiles: {
            csv: `${outputBaseName}.csv`,
            xlsx: `${outputBaseName}.xlsx`,
            html: `${outputBaseName}.html`
          },
          stdout: stdoutData
        });
      } else {
        reject({
          success: false,
          error: `Ошибка при конвертации, код ошибки: ${code}`,
          stderr: stderrData
        });
      }
    });
  });
}

// API-обработчик для загрузки и конвертации XML
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
    const fileField = formData.find(field => field.name === 'xmlFile');
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

    // Сохраняем файл во временную директорию
    const filePath = path.join(TEMP_UPLOAD_DIR, safeFilename);
    await fs.writeFile(filePath, fileField.data);

    // Определяем имя выходного файла без расширения
    const outputBaseName = path.join(OUTPUT_DIR, path.basename(safeFilename, '.xml'));

    // Конвертируем файл
    const result = await convertXmlFile(filePath, outputBaseName);

    // Получаем относительные пути к файлам для доступа через API
    const relativePaths = {
      csv: `/api/download?file=${path.basename(result.outputFiles.csv)}`,
      xlsx: `/api/download?file=${path.basename(result.outputFiles.xlsx)}`,
      html: `/api/download?file=${path.basename(result.outputFiles.html)}`
    };

    // Возвращаем информацию о результате операции
    return {
      success: true,
      originalFilename,
      fileSize: fileField.data.length,
      convertedFiles: relativePaths,
      message: 'Файл успешно конвертирован',
      isDemo: isVercel
    };
  } catch (error) {
    console.error('Ошибка при обработке загрузки:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при обработке файла: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
