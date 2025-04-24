<template>
  <div class="file-list-container">
    <div class="file-list-header">
      <h2>Список файлов</h2>
      <button
        class="refresh-button"
        @click="emit('refresh')"
        :disabled="loading"
        title="Обновить список файлов"
      >
        <span class="refresh-icon" :class="{ refreshing: loading }">🔄</span>
        <span class="button-text">Обновить</span>
      </button>
    </div>

    <div v-if="isDemo" class="demo-mode-alert">
      <strong>Демо-режим:</strong> В этом режиме показаны примеры файлов.
      Функции загрузки и обработки ограничены.
    </div>

    <div v-if="loading" class="loading-indicator">
      <div class="spinner"></div>
      <span>Загрузка списка файлов...</span>
    </div>

    <div v-else-if="files.length === 0" class="empty-list">
      <p>Нет доступных файлов</p>
      <p class="empty-list-hint">Загрузите файлы XML для начала работы</p>
    </div>

    <div v-else class="files-table-container">
      <table class="files-table">
        <thead>
          <tr>
            <th>Тип</th>
            <th>Имя файла</th>
            <th>Размер</th>
            <th>Дата изменения</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="file in files"
            :key="file.path"
            :class="getRowClass(file.name)"
          >
            <td class="file-icon">{{ getFileIcon(file.name) }}</td>
            <td class="file-name">{{ file.name }}</td>
            <td class="file-size">{{ formatFileSize(file.size) }}</td>
            <td class="file-date">{{ formatDate(file.mtime) }}</td>
            <td class="file-actions">
              <!-- Кнопки действий в зависимости от типа файла -->
              <template v-if="file.name.toLowerCase().endsWith('.xml')">
                <button
                  class="action-button process-button"
                  @click="processFile(file)"
                  title="Обработать XML файл"
                >
                  ⚙️
                </button>
              </template>

              <button
                class="action-button download-button"
                @click="downloadFile(file)"
                title="Скачать файл"
              >
                ⬇️
              </button>

              <button
                class="action-button delete-button"
                @click="deleteFile(file)"
                title="Удалить файл"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits, defineProps } from "vue";
import { useToast } from "vue-toastification";

// Определяем входные пропсы компонента
const props = defineProps({
  files: {
    type: Array,
    default: () => [],
  },
  processing: {
    type: Boolean,
    default: false,
  },
});

// Получаем доступ к системе уведомлений
const toast = useToast();

// Определяем события, которые компонент может излучать
const emit = defineEmits(["refresh", "process", "download", "delete"]);

// Состояние компонента
const loading = ref(false);
const isDemo = ref(false);

// Загрузка списка файлов с сервера
const loadFiles = async () => {
  try {
    loading.value = true;
    const response = await fetch("/api/files");

    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }

    const data = await response.json();
    // files теперь передаются через пропсы
    // files.value = data.files || [];
    isDemo.value = data.isDemo || false;

    if (isDemo.value) {
      toast.info("Работаем в демо-режиме. Некоторые функции ограничены.");
    }

    // Отправляем результат загрузки родительскому компоненту
    emit("refresh", data.files || []);
  } catch (error) {
    console.error("Ошибка при загрузке списка файлов:", error);
    toast.error(`Не удалось загрузить список файлов: ${error.message}`);
    emit("refresh", []);
  } finally {
    loading.value = false;
  }
};

// Обработка XML файла
const processFile = async (file) => {
  try {
    if (!file || !file.path) {
      throw new Error("Некорректный файл для обработки");
    }

    emit("process", file);
  } catch (error) {
    console.error("Ошибка при обработке файла:", error);
    toast.error(`Не удалось обработать файл: ${error.message}`);
  }
};

// Скачивание файла
const downloadFile = async (file) => {
  try {
    if (!file || !file.path) {
      throw new Error("Некорректный файл для скачивания");
    }

    emit("download", file);
  } catch (error) {
    console.error("Ошибка при скачивании файла:", error);
    toast.error(`Не удалось скачать файл: ${error.message}`);
  }
};

// Удаление файла
const deleteFile = async (file) => {
  try {
    if (!file || !file.path) {
      throw new Error("Некорректный файл для удаления");
    }

    if (confirm(`Вы уверены, что хотите удалить файл "${file.name}"?`)) {
      emit("delete", file);
    }
  } catch (error) {
    console.error("Ошибка при удалении файла:", error);
    toast.error(`Не удалось удалить файл: ${error.message}`);
  }
};

// Форматирование даты
const formatDate = (timestamp) => {
  if (!timestamp) return "Нет данных";

  const date = new Date(timestamp);

  // Проверяем корректность даты
  if (isNaN(date.getTime())) return "Некорректная дата";

  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// Форматирование размера файла
const formatFileSize = (sizeInBytes) => {
  if (!sizeInBytes || isNaN(parseInt(sizeInBytes))) return "Нет данных";

  sizeInBytes = parseInt(sizeInBytes);

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  } else if (sizeInBytes < 1024 * 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

// Определение типа файла по расширению и возврат иконки
const getFileIcon = (fileName) => {
  if (!fileName) return "📄";

  const extension = fileName.split(".").pop().toLowerCase();

  switch (extension) {
    case "xml":
      return "📋";
    case "csv":
      return "📊";
    case "xlsx":
      return "📈";
    case "html":
      return "🌐";
    default:
      return "📄";
  }
};

// Получение класса стиля для строки таблицы в зависимости от типа файла
const getRowClass = (fileName) => {
  if (!fileName) return "";

  const extension = fileName.split(".").pop().toLowerCase();

  switch (extension) {
    case "xml":
      return "file-row-xml";
    case "csv":
      return "file-row-csv";
    case "xlsx":
      return "file-row-xlsx";
    case "html":
      return "file-row-html";
    default:
      return "";
  }
};

// При монтировании компонента загружаем список файлов
onMounted(() => {
  loadFiles();
});

// Метод для обновления списка файлов (может быть вызван из родительского компонента)
const refreshFileList = () => {
  loadFiles();
};

// Экспортируем методы для использования извне
defineExpose({
  refreshFileList,
});
</script>

<style scoped>
.file-list-container {
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.file-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.file-list-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #333;
}

.refresh-button {
  display: flex;
  align-items: center;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-button:hover {
  background-color: #e9e9e9;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.refresh-icon {
  display: inline-block;
  margin-right: 0.5rem;
}

.refreshing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.demo-mode-alert {
  background-color: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: #856404;
}

.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #666;
}

.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid #3498db;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  margin-right: 0.75rem;
}

.empty-list {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.empty-list-hint {
  font-size: 0.9rem;
  color: #999;
  margin-top: 0.5rem;
}

.files-table-container {
  overflow-x: auto;
}

.files-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.files-table th {
  background-color: #f5f5f5;
  padding: 0.75rem;
  text-align: left;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
}

.files-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #eee;
}

.file-icon {
  text-align: center;
  font-size: 1.2rem;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
  word-break: break-all;
}

.file-size,
.file-date {
  color: #666;
  white-space: nowrap;
}

.file-actions {
  white-space: nowrap;
  text-align: center;
}

.action-button {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
  margin: 0 0.25rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-button:hover {
  background-color: #f5f5f5;
}

.process-button:hover {
  background-color: #e8f4fd;
}

.download-button:hover {
  background-color: #e8f8e8;
}

.delete-button:hover {
  background-color: #fee;
}

/* Стили для строк разных типов файлов */
.file-row-xml {
  background-color: #f8fdff;
}

.file-row-csv {
  background-color: #f8fff8;
}

.file-row-xlsx {
  background-color: #fffdf8;
}

.file-row-html {
  background-color: #fff8fd;
}
</style>
