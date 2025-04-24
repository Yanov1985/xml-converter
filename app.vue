<template>
  <div>
    <header class="app-header">
      <div class="container">
        <h1 class="logo">XML Конвертер</h1>
        <p class="description">Конвертация XML файлов в CSV, Excel и HTML</p>
      </div>
    </header>

    <main class="page-container">
      <XmlConverter />
    </main>

    <footer class="app-footer">
      <div class="container">
        <p>© 2025 XML Конвертер. Все права защищены.</p>
      </div>
    </footer>
  </div>
</template>

<style>
.app-header {
  background-color: var(--primary-color);
  color: white;
  padding: 20px 0;
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  font-size: 28px;
  margin: 0;
  letter-spacing: 1px;
}

.description {
  margin: 10px 0 0;
  opacity: 0.9;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.app-footer {
  background-color: var(--dark-color);
  color: white;
  padding: 20px 0;
  text-align: center;
  margin-top: 50px;
  font-size: 14px;
}
</style>
