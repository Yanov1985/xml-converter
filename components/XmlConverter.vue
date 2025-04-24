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
          @dragenter.prevent="handleDragEnter"
          @dragleave.prevent="handleDragLeave"
          @dragover.prevent
          @drop.prevent="handleDrop"
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
          <div class="mt-3">
            <UButton size="sm" @click="clearError">Попробовать снова</UButton>
          </div>
        </div>

        <UAlert
          v-if="isVercelEnv"
          variant="soft"
          color="amber"
          title="Ограничения Vercel"
          :icon="'i-heroicons-information-circle'"
          class="my-4"
        >
          На Vercel функция загрузки файлов работает в демо-режиме с
          ограничениями. Для полноценной работы с конвертером рекомендуется
          установить приложение локально.
        </UAlert>

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

    <FileList
      @refresh="refreshFileList"
      @process="processXml"
      @download="downloadFile"
      @delete="deleteFile"
      :files="files"
      :processing="processing"
      ref="fileListRef"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, inject, nextTick, useRuntimeConfig } from "vue";
import { useToast } from "vue-toastification";
import fileDownload from "js-file-download";
import FileList from "./FileList.vue";

// Состояние компонента
const isUploading = ref(false);
const dragover = ref(false);
const fileInput = ref(null);
const files = ref([]);
const errorMessage = ref("");
const successMessage = ref("");
const processing = ref(false);
const fileListRef = ref(null);
const isVercelEnv = ref(false); // Флаг для определения среды Vercel

// Инициализация сервисов
const toast = useToast();
const $fetch = inject("$fetch");

// Последний загруженный файл
const lastUploadedFile = ref(null);
const error = ref("");
const isDragging = ref(false);
const uploadProgress = ref(0);

// Проверка окружения при загрузке компонента
onMounted(async () => {
  try {
    const envInfo = await $fetch("/api/check-env");
    isVercelEnv.value = envInfo.isVercel;
    console.log("Окружение:", envInfo);

    // Загружаем список файлов при монтировании компонента
    await refreshFileList();
  } catch (error) {
    console.error("Ошибка при проверке окружения:", error);
    isVercelEnv.value = false; // По умолчанию считаем, что не в Vercel
  }
});

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

// Очистка ошибки
function clearError() {
  errorMessage.value = "";
  if (fileInput.value) {
    fileInput.value.value = "";
  }
}

// Открыть диалог выбора файла при клике на drop zone
function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click();
  }
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

// Обработка события Drop с улучшенной обработкой ошибок
function handleDrop(e) {
  e.preventDefault();
  dragover.value = false;
  errorMessage.value = "";

  if (!e.dataTransfer.files.length) return;

  const file = e.dataTransfer.files[0];

  // Валидация файла
  if (!validateFile(file)) return;

  // Загрузка файла
  uploadFile(file);
}

// Проверка валидности файла
const validateFile = (file) => {
  // Проверка расширения файла
  if (!file.name.toLowerCase().endsWith(".xml")) {
    errorMessage.value = "Пожалуйста, выберите XML файл";
    toast.error("Нужно выбрать XML файл");
    return false;
  }

  // Проверка размера файла (максимум 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB в байтах
  if (file.size > maxSize) {
    errorMessage.value = `Файл слишком большой. Максимальный размер: 5MB`;
    toast.error("Файл слишком большой");
    return false;
  }

  return true;
};

// Обработчик выбора файла
function handleFileChange(e) {
  errorMessage.value = "";

  if (!e.target.files.length) return;

  const file = e.target.files[0];

  // Валидация файла
  if (!validateFile(file)) {
    e.target.value = null; // Сбрасываем input
    return;
  }

  // Загрузка файла
  uploadFile(file);
  e.target.value = null; // Сбрасываем input после загрузки
}

// Загрузка файла на сервер
const uploadFile = async (file) => {
  isUploading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const formData = new FormData();
    formData.append("file", file);

    if (isVercelEnv.value) {
      // В среде Vercel показываем предупреждение о демо-режиме
      toast.info("В демо-режиме некоторые функции могут быть ограничены");
    }

    const response = await $fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (response.success) {
      toast.success("Файл успешно загружен!");
      successMessage.value = `Файл "${file.name}" успешно загружен!`;

      // Обновляем список файлов после успешной загрузки
      await refreshFileList();
    } else {
      throw new Error(response.error || "Неизвестная ошибка");
    }
  } catch (error) {
    console.error("Ошибка загрузки:", error);
    errorMessage.value = error.message || "Произошла ошибка при загрузке файла";
    toast.error(errorMessage.value);
  } finally {
    isUploading.value = false;
  }
};

// Функция для обновления списка файлов
const refreshFileList = async () => {
  try {
    const response = await $fetch("/api/files");
    files.value = response.files || [];
  } catch (error) {
    console.error("Ошибка при загрузке списка файлов:", error);
    files.value = [];
    toast.error("Не удалось загрузить список файлов");
  }
};

// Обработка XML файла
const processXml = async (file) => {
  if (!file || !file.name) {
    toast.error("Не указан файл для обработки");
    return;
  }

  processing.value = true;
  errorMessage.value = "";

  try {
    const response = await $fetch("/api/process", {
      method: "POST",
      body: {
        filename: file.name,
      },
    });

    if (response.success) {
      toast.success("Файл успешно обработан!");

      // Обновляем список файлов после обработки
      await refreshFileList();
    } else {
      throw new Error(response.error || "Ошибка при обработке файла");
    }
  } catch (error) {
    console.error("Ошибка обработки:", error);
    errorMessage.value = error.message || "Произошла ошибка при обработке XML";
    toast.error(errorMessage.value);
  } finally {
    processing.value = false;
  }
};

// Скачивание файла
const downloadFile = async (file) => {
  if (!file || !file.path) {
    toast.error("Не указан файл для скачивания");
    return;
  }

  try {
    const response = await $fetch(
      `/api/download?filePath=${encodeURIComponent(file.path)}`,
      {
        responseType: "blob",
      }
    );

    fileDownload(response, file.name);
    toast.success("Файл успешно скачан!");
  } catch (error) {
    console.error("Ошибка скачивания:", error);
    toast.error("Ошибка при скачивании файла");
  }
};

// Удаление файла
const deleteFile = async (file) => {
  if (!file || !file.path) {
    toast.error("Не указан файл для удаления");
    return;
  }

  try {
    const response = await $fetch("/api/delete", {
      method: "DELETE",
      body: {
        filePath: file.path,
      },
    });

    if (response.success) {
      toast.success("Файл успешно удален!");
      await refreshFileList();
    } else {
      throw new Error(response.error || "Ошибка при удалении файла");
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    toast.error("Ошибка при удалении файла");
  }
};
</script>

<style scoped>
.dropzone {
  position: relative;
  z-index: 1;
}

.file-error {
  margin-top: 15px;
  padding: 12px;
  background-color: rgba(var(--danger-color-rgb, 220, 53, 69), 0.1);
  border-radius: 6px;
  color: var(--danger-color, #dc3545);
}
</style>
