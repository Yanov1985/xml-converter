import { createError, defineEventHandler, readMultipartFormData } from 'h3';
import fs from 'fs';
import path from 'path';
import { getBasePath } from '../utils/environment';

/**
 * API-эндпоинт для загрузки XML-файлов
 *
 * Принимает XML-файлы через multipart/form-data, сохраняет их
 * в директории xml и возвращает информацию о загруженных файлах
 */
export default defineEventHandler(async (event) => {
  try {
    // Определяем базовую директорию с помощью утилиты
    const basePath = getBasePath();

    // Путь к директории для XML-файлов
    const xmlDirPath = path.join(basePath, 'xml');

    // Создаем директорию, если она не существует
    if (!fs.existsSync(xmlDirPath)) {
      fs.mkdirSync(xmlDirPath, { recursive: true });
    }

    // Получаем данные формы (multipart/form-data)
    const formData = await readMultipartFormData(event);

    // Проверяем, что получили данные
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Файлы не найдены. Пожалуйста, загрузите XML-файлы.'
      });
    }

    // Массив для хранения информации о загруженных файлах
    const uploadedFiles = [];

    // Обрабатываем каждый файл из формы
    for (const file of formData) {
      // Проверяем, что это файл и имеет имя
      if (!file.filename) {
        continue;
      }

      // Проверяем расширение файла
      const fileExt = path.extname(file.filename).toLowerCase();
      if (fileExt !== '.xml') {
        throw createError({
          statusCode: 400,
          message: `Файл "${file.filename}" не является XML-файлом. Поддерживаются только файлы с расширением .xml`
        });
      }

      // Генерируем уникальное имя файла, чтобы избежать перезаписи
      const timestamp = new Date().getTime();
      const sanitizedFilename = file.filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
      const uniqueFilename = `${path.basename(sanitizedFilename, fileExt)}_${timestamp}${fileExt}`;
      const filePath = path.join(xmlDirPath, uniqueFilename);

      // Сохраняем файл
      fs.writeFileSync(filePath, file.data);

      // Получаем информацию о файле
      const stats = fs.statSync(filePath);

      // Добавляем информацию о загруженном файле
      uploadedFiles.push({
        originalName: file.filename,
        name: uniqueFilename,
        path: path.relative(basePath, filePath).replace(/\\/g, '/'),
        size: stats.size,
        mtime: stats.mtime,
        type: 'xml'
      });
    }

    // Проверяем, что хотя бы один файл был загружен
    if (uploadedFiles.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Не удалось загрузить файлы. Пожалуйста, убедитесь, что вы загружаете XML-файлы.'
      });
    }

    // Возвращаем информацию о загруженных файлах
    return {
      success: true,
      message: uploadedFiles.length === 1
        ? 'Файл успешно загружен'
        : `Загружено ${uploadedFiles.length} файлов`,
      files: uploadedFiles
    };

  } catch (error) {
    console.error('Ошибка при загрузке файлов:', error);

    // Возвращаем ошибку в формате, который ожидается на клиенте
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Произошла ошибка при загрузке файлов'
    });
  }
});
