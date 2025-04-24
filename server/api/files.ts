import { defineEventHandler, createError } from 'h3';
import { promises as fs } from 'fs';
import path from 'path';

// Путь к папке с конвертированными файлами
const isVercel = process.env.VERCEL === '1';
const OUTPUT_DIR = isVercel
  ? path.join('/tmp', 'converted')
  : path.resolve(process.cwd(), '../converted');

// Интерфейс для информации о файле
interface FileInfo {
  name: string;
  originalName: string;
  size: number;
  type: string;
  date: string;
  downloadUrl: string;
}

// Группируем файлы по их базовому имени (без расширения)
interface FileGroup {
  id: string;
  originalName: string; // Оригинальное имя файла без UUID
  date: string;
  files: {
    csv?: FileInfo;
    xlsx?: FileInfo;
    html?: FileInfo;
  }
}

// Создаем демо-записи для Vercel
function createDemoFiles(): FileGroup[] {
  const now = new Date().toISOString();
  const demoFiles: FileGroup[] = [];

  // Демо-группа 1
  demoFiles.push({
    id: '1',
    originalName: 'products.xml',
    date: now,
    files: {
      csv: {
        name: 'products.csv',
        originalName: 'products.xml',
        size: 1024,
        type: 'csv',
        date: now,
        downloadUrl: '/api/download?file=products.csv'
      },
      xlsx: {
        name: 'products.xlsx',
        originalName: 'products.xml',
        size: 5120,
        type: 'xlsx',
        date: now,
        downloadUrl: '/api/download?file=products.xlsx'
      },
      html: {
        name: 'products.html',
        originalName: 'products.xml',
        size: 2048,
        type: 'html',
        date: now,
        downloadUrl: '/api/download?file=products.html'
      }
    }
  });

  // Демо-группа 2
  demoFiles.push({
    id: '2',
    originalName: 'categories.xml',
    date: new Date(Date.now() - 86400000).toISOString(), // Вчера
    files: {
      csv: {
        name: 'categories.csv',
        originalName: 'categories.xml',
        size: 512,
        type: 'csv',
        date: new Date(Date.now() - 86400000).toISOString(),
        downloadUrl: '/api/download?file=categories.csv'
      },
      html: {
        name: 'categories.html',
        originalName: 'categories.xml',
        size: 1024,
        type: 'html',
        date: new Date(Date.now() - 86400000).toISOString(),
        downloadUrl: '/api/download?file=categories.html'
      }
    }
  });

  return demoFiles;
}

// API-обработчик для получения списка конвертированных файлов
export default defineEventHandler(async () => {
  try {
    // Для Vercel возвращаем демо-данные
    if (isVercel) {
      const demoFiles = createDemoFiles();

      return {
        success: true,
        count: demoFiles.length,
        groups: demoFiles,
        isDemo: true
      };
    }

    // Убеждаемся, что директория существует
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
      console.error('Ошибка при создании директории:', error);
    }

    // Получаем список файлов
    const files = await fs.readdir(OUTPUT_DIR);

    // Фильтруем только нужные типы файлов
    const validExtensions = ['.csv', '.xlsx', '.html'];
    const validFiles = files.filter(file =>
      validExtensions.some(ext => file.toLowerCase().endsWith(ext))
    );

    // Собираем информацию о каждом файле
    const fileInfoPromises = validFiles.map(async (fileName) => {
      try {
        const filePath = path.join(OUTPUT_DIR, fileName);
        const stats = await fs.stat(filePath);

        // Определяем тип файла
        const extension = path.extname(fileName).toLowerCase();
        const fileType = extension === '.csv' ? 'csv' :
                        extension === '.xlsx' ? 'xlsx' :
                        extension === '.html' ? 'html' : 'unknown';

        // Извлекаем ID и оригинальное имя из имени файла
        const baseName = path.basename(fileName, extension);
        let originalName = baseName;
        let fileId = baseName;

        // Если файл имеет формат UUID_originalname
        const uuidMatch = baseName.match(/^([0-9a-f-]{36})_(.+)$/i);
        if (uuidMatch) {
          fileId = uuidMatch[1];
          originalName = uuidMatch[2];
        }

        return {
          name: fileName,
          baseName: baseName,
          originalName: originalName,
          fileId: fileId,
          size: stats.size,
          type: fileType,
          date: stats.mtime.toISOString(),
          downloadUrl: `/api/download?file=${encodeURIComponent(fileName)}`
        };
      } catch (error) {
        console.error(`Ошибка при получении информации о файле ${fileName}:`, error);
        return null;
      }
    });

    // Ожидаем завершения всех промисов и удаляем null-значения
    const fileInfos = (await Promise.all(fileInfoPromises)).filter(Boolean);

    // Группируем файлы по их базовому имени
    const fileGroups = new Map<string, FileGroup>();

    fileInfos.forEach(fileInfo => {
      if (!fileInfo) return;

      const { fileId, originalName, name, size, type, date, downloadUrl } = fileInfo;

      if (!fileGroups.has(fileId)) {
        fileGroups.set(fileId, {
          id: fileId,
          originalName: originalName,
          date: date,
          files: {}
        });
      }

      const group = fileGroups.get(fileId)!;

      // Обновляем дату, если файл новее
      if (new Date(date) > new Date(group.date)) {
        group.date = date;
      }

      // Добавляем файл в соответствующую группу
      group.files[type as keyof typeof group.files] = {
        name,
        originalName,
        size,
        type,
        date,
        downloadUrl
      };
    });

    // Преобразуем Map в массив и сортируем по дате (новые вверху)
    const sortedGroups = Array.from(fileGroups.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      count: sortedGroups.length,
      groups: sortedGroups,
      isDemo: false
    };

  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);

    return createError({
      statusCode: 500,
      statusMessage: `Ошибка при получении списка файлов: ${error.message || 'Неизвестная ошибка'}`
    });
  }
});
