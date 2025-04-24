// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  app: {
    head: {
      title: 'XML Конвертер',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Веб-интерфейс для конвертации XML файлов в CSV, Excel и HTML' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  modules: [
    '@nuxt/ui'
  ],
  css: [
    '~/assets/css/main.css'
  ],
  runtimeConfig: {
    // Конфигурация, доступная только на сервере
    uploadDir: process.env.UPLOAD_DIR || '../xml',
    outputDir: process.env.OUTPUT_DIR || '../converted',
    // Публичные ключи для клиентского кода
    public: {
      maxUploadSize: 10 * 1024 * 1024 // 10 МБ по умолчанию
    }
  }
})
