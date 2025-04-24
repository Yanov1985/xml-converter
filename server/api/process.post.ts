import { createError, defineEventHandler } from 'h3';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getBasePath } from '../utils/environment';

// Превращаем exec в Promise-версию для удобства использования
const execAsync = promisify(exec);

/**
 * API-эндпоинт для обработки XML-файлов
 *
 * Принимает имя XML-файла и запускает скрипт для его конвертации в CSV/Excel/HTML
 */
export default defineEventHandler(async (event) => {
  try {
    // Получаем данные запроса
    const body = await readBody(event);

    // Проверяем наличие имени файла в запросе
    if (!body || !body.filename) {
      throw createError({
        statusCode: 400,
        message: 'Не указано имя файла для обработки'
      });
    }

    const filename = body.filename;

    // Определяем базовую директорию с помощью утилиты
    const basePath = getBasePath();

    // Пути к директориям
    const xmlDirPath = path.join(basePath, 'xml');
    const convertedDirPath = path.join(basePath, 'converted');

    // Проверяем, существует ли файл
    const xmlFilePath = path.join(xmlDirPath, filename);
    if (!fs.existsSync(xmlFilePath)) {
      throw createError({
        statusCode: 404,
        message: `Файл "${filename}" не найден`
      });
    }

    // Создаем директорию для конвертированных файлов, если она не существует
    if (!fs.existsSync(convertedDirPath)) {
      fs.mkdirSync(convertedDirPath, { recursive: true });
    }

    // Логирование начала процесса
    console.log(`Начинаем обработку файла: ${filename}`);

    // Формируем команду для запуска скрипта обработки
    const xmlToCSVScript = path.join(process.cwd(), 'xml-to-csv.js');
    const command = `node "${xmlToCSVScript}" "${xmlFilePath}" --output-dir="${convertedDirPath}"`;

    console.log(`Выполняем команду: ${command}`);

    // Запускаем скрипт обработки
    const { stdout, stderr } = await execAsync(command);

    // Проверяем на наличие ошибок
    if (stderr && stderr.trim() !== '') {
      console.error(`Ошибка при обработке файла: ${stderr}`);
      throw createError({
        statusCode: 500,
        message: `Ошибка при обработке файла: ${stderr}`
      });
    }

    console.log(`Результат обработки: ${stdout}`);

    // Получаем имя файла без расширения для поиска конвертированных файлов
    const filenameWithoutExt = path.basename(filename, '.xml');

    // Ищем созданные файлы в директории converted
    const generatedFiles = [];
    const fileTypes = ['.csv', '.xlsx', '.html'];

    fileTypes.forEach(ext => {
      // Ищем файлы с шаблоном имени: [имя_файла]_[timestamp].[расширение]
      const files = fs.readdirSync(convertedDirPath).filter(file => {
        return file.startsWith(filenameWithoutExt) && file.endsWith(ext);
      });

      files.forEach(file => {
        const filePath = path.join(convertedDirPath, file);
        const stats = fs.statSync(filePath);

        generatedFiles.push({
          name: file,
          path: path.relative(basePath, filePath).replace(/\\/g, '/'),
          size: stats.size,
          mtime: stats.mtime,
          type: ext.substring(1) // Убираем точку из расширения
        });
      });
    });

    // Возвращаем результат
    return {
      success: true,
      message: 'Файл успешно обработан',
      files: generatedFiles
    };

  } catch (error) {
    console.error('Ошибка при обработке файла:', error);

    // Возвращаем ошибку в формате, который ожидается на клиенте
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Произошла ошибка при обработке файла'
    });
  }
});
