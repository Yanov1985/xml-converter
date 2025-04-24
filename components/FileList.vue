<template>
  <div class="card">
    <div class="card-header">
      <div class="header-with-controls">
        <h2 class="card-title">Конвертированные файлы</h2>
        <UButton
          icon="i-heroicons-arrow-path"
          color="primary"
          variant="ghost"
          size="sm"
          :loading="isLoading"
          @click="loadFiles"
        >
          Обновить
        </UButton>
      </div>
    </div>
    <div class="card-body">
      <div v-if="isLoading" class="loading-indicator">
        <ULoader />
        <p>Загрузка списка файлов...</p>
      </div>

      <UAlert
        v-if="isDemoMode"
        variant="soft"
        color="amber"
        title="Вы используете демо-режим Vercel"
        :icon="'i-heroicons-information-circle'"
        class="mb-4"
      >
        В демо-режиме отображаются тестовые файлы. Для полноценной работы
        установите приложение локально.
      </UAlert>

      <div v-else-if="error" class="file-error">
        <Icon name="i-heroicons-exclamation-triangle" />
        {{ error }}
        <div class="mt-3">
          <UButton size="sm" @click="loadFiles">Попробовать снова</UButton>
        </div>
      </div>

      <div v-else-if="fileGroups.length === 0" class="no-files-message">
        <Icon name="i-heroicons-document-text" size="xl" class="mb-3" />
        <h3>Нет конвертированных файлов</h3>
        <p>Загрузите XML файл для конвертации</p>
      </div>

      <div v-else class="file-list">
        <div v-for="group in fileGroups" :key="group.id" class="file-item">
          <div class="file-item-header">
            <h3>{{ group.originalName }}</h3>
            <span class="file-info">{{ formatDate(group.date) }}</span>
          </div>
          <div class="file-item-body">
            <a
              v-if="group.files.csv"
              :href="group.files.csv.downloadUrl"
              class="download-link csv"
              download
            >
              <Icon name="i-heroicons-document-text" />
              Скачать CSV
            </a>
            <a
              v-if="group.files.xlsx"
              :href="group.files.xlsx.downloadUrl"
              class="download-link xlsx"
              download
            >
              <Icon name="i-heroicons-table-cells" />
              Скачать Excel
            </a>
            <a
              v-if="group.files.html"
              :href="group.files.html.downloadUrl"
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
</template>

<script setup>
import { ref, onMounted } from "vue";

// Состояние компонента
const isLoading = ref(false);
const error = ref("");
const fileGroups = ref([]);
const isDemoMode = ref(false);

// Загрузка списка файлов при монтировании компонента
onMounted(() => {
  loadFiles();
});

// Функция для форматирования даты
function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Загрузка списка файлов с сервера
async function loadFiles() {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await fetch("/api/files");

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.statusMessage || "Ошибка при загрузке списка файлов"
      );
    }

    const result = await response.json();
    fileGroups.value = result.groups || [];
    isDemoMode.value = result.isDemo || false;
  } catch (err) {
    error.value = err.message || "Произошла ошибка при загрузке списка файлов";
    console.error("Ошибка загрузки файлов:", err);
  } finally {
    isLoading.value = false;
  }
}

// Экспортируем методы для родительского компонента
defineExpose({
  refresh: loadFiles,
});
</script>

<style scoped>
.header-with-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.loading-indicator p {
  margin-top: 10px;
  color: #666;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
