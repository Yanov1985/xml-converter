<template>
  <div>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Загрузка XML файла</h2>
      </div>
      <div class="card-body">
        <div
          class="dropzone"
          :class="{ active: isDragging || isUploading }"
          @dragenter="handleDragEnter"
          @dragleave="handleDragLeave"
          @dragover.prevent
          @drop="handleDrop"
          @click="triggerFileInput"
        >
          <div v-if="!isUploading">
            <div class="dropzone-icon">
              <Icon name="i-heroicons-cloud-arrow-up" size="xl" />
            </div>
            <h3>Перетащите XML файл сюда или нажмите для выбора</h3>
            <p>
              Поддерживаются файлы XML с максимальным размером
              {{ formatFileSize(maxFileSize) }}
            </p>
          </div>
          <div v-else class="upload-progress">
            <UProgress :value="uploadProgress" color="primary" />
            <p>Загрузка и обработка файла... {{ uploadProgress }}%</p>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept=".xml"
            style="display: none"
            @change="handleFileChange"
          />
        </div>

        <div v-if="error" class="file-error">
          <Icon name="i-heroicons-exclamation-triangle" /> {{ error }}
        </div>

        <div v-if="lastUploadedFile" class="upload-result">
          <UAlert
            variant="soft"
            color="green"
            title="Файл успешно конвертирован"
            :icon="'i-heroicons-check-circle'"
            class="mb-4"
          />

          <UAlert
            v-if="lastUploadedFile && lastUploadedFile.isDemo"
            variant="soft"
            color="amber"
            title="Вы используете демо-режим Vercel"
            :icon="'i-heroicons-information-circle'"
            class="mb-4"
          >
            <p>
              В демо-режиме Vercel настоящая конвертация XML невозможна из-за
              ограничений серверлесс-функций.
            </p>
            <p>
              Загрузка работает, но файлы создаются автоматически как
              демонстрационные примеры.
            </p>
            <p>Для полноценной работы установите приложение локально.</p>
            <details>
              <summary>Техническая информация</summary>
              <pre class="text-xs mt-2 p-2 bg-gray-100 rounded">{{
                JSON.stringify(lastUploadedFile, null, 2)
              }}</pre>
            </details>
          </UAlert>

          <div class="file-item">
            <div class="file-item-header">
              <h3>{{ lastUploadedFile.originalFilename }}</h3>
              <span class="file-info">{{
                formatFileSize(lastUploadedFile.fileSize)
              }}</span>
            </div>
            <div class="file-item-body">
              <a
                v-if="lastUploadedFile.convertedFiles.csv"
                :href="lastUploadedFile.convertedFiles.csv"
                class="download-link csv"
                download
              >
                <Icon name="i-heroicons-document-text" />
                Скачать CSV
              </a>
              <a
                v-if="lastUploadedFile.convertedFiles.xlsx"
                :href="lastUploadedFile.convertedFiles.xlsx"
                class="download-link xlsx"
                download
              >
                <Icon name="i-heroicons-table-cells" />
                Скачать Excel
              </a>
              <a
                v-if="lastUploadedFile.convertedFiles.html"
                :href="lastUploadedFile.convertedFiles.html"
                target="_blank"
                class="download-link html"
              >
                <Icon name="i-heroicons-globe-alt" />
                Открыть в браузере
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <FileList @refresh="refreshFileList" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

// Компоненты UI
const fileInput = ref(null);
const isDragging = ref(false);
const isUploading = ref(false);
const uploadProgress = ref(0);
const error = ref("");
const lastUploadedFile = ref(null);

// Максимальный размер загружаемого файла
const runtimeConfig = useRuntimeConfig();
const maxFileSize = runtimeConfig.public.maxUploadSize || 10 * 1024 * 1024; // 10 МБ по умолчанию

// Функция форматирования размера файла
function formatFileSize(size) {
  if (size < 1024) {
    return `${size} байт`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} КБ`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
  }
}

// Открыть диалог выбора файла при клике на drop zone
function triggerFileInput() {
  fileInput.value.click();
}

// Обработка событий перетаскивания
function handleDragEnter(e) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e) {
  e.preventDefault();
  isDragging.value = false;
}

// Обработка события Drop
function handleDrop(e) {
  e.preventDefault();
  isDragging.value = false;

  const files = e.dataTransfer.files;
  if (files.length) {
    handleFile(files[0]);
  }
}

// Обработка выбора файла через input
function handleFileChange(e) {
  const files = e.target.files;
  if (files.length) {
    handleFile(files[0]);
  }
}

// Основная функция обработки файла
function handleFile(file) {
  // Сбрасываем предыдущие ошибки и результаты
  error.value = "";
  lastUploadedFile.value = null;

  // Проверка типа файла
  if (!file.name.toLowerCase().endsWith(".xml")) {
    error.value =
      "Выбранный файл не является XML файлом. Пожалуйста, выберите файл с расширением .xml";
    return;
  }

  // Проверка размера файла
  if (file.size > maxFileSize) {
    error.value = `Файл слишком большой. Максимальный размер: ${formatFileSize(
      maxFileSize
    )}`;
    return;
  }

  // Загрузка файла
  uploadFile(file);
}

// Функция загрузки файла на сервер
async function uploadFile(file) {
  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    const formData = new FormData();
    formData.append("xmlFile", file);

    // Эмуляция прогресса загрузки
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += Math.random() * 10;
      }
    }, 300);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    clearInterval(progressInterval);

    // Проверка ответа
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = errorData.statusMessage || "Ошибка при загрузке файла";
      } catch (e) {
        errorMessage = `Ошибка сервера: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Обработка успешного ответа
    uploadProgress.value = 100;
    const result = await response.json();

    // Сохраняем информацию о загруженном файле
    lastUploadedFile.value = result;

    // Обновляем список файлов
    refreshFileList();
  } catch (err) {
    error.value = err.message || "Произошла ошибка при загрузке файла";
    console.error("Ошибка загрузки:", err);

    // Добавляем больше информации для отладки
    if (err.stack) {
      console.error("Стек ошибки:", err.stack);
    }
  } finally {
    setTimeout(() => {
      isUploading.value = false;
      // Сбрасываем input для возможности повторной загрузки того же файла
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    }, 500);
  }
}

// Метод для обновления списка файлов в дочернем компоненте
function refreshFileList() {
  // Этот метод будет вызывать метод refresh в компоненте FileList
  // Реализация через emit в дочернем компоненте
}
</script>
