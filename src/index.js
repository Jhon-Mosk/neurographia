#!/usr/bin/env node

'use strict';

const { initDB, getStats, closeDB } = require('./db');
const { startSession } = require('./cli');

/**
 * Корректный выход из приложения
 */
function gracefulExit(code = 0) {
  try {
    closeDB();
  } catch (e) {
    console.error('Ошибка закрытия БД:', e.message);
  }

  process.exit(code);
}

async function main() {
  console.log('🚀 Запуск NeuroEnglish...\n');

  try {
    await initDB();

    // Проверка наличия данных
    const stats = getStats();

    if (!stats.length) {
      console.log('❗ База данных пуста!');
      console.log('💡 Добавьте фразы в файл data/phrases.json и выполните:');
      console.log('   npm run init-db\n');
      gracefulExit(0);
      return;
    }

    // Запуск сессии обучения
    await startSession();
  } catch (err) {
    console.error(`❌ Критическая ошибка: ${err.message}`);
    console.error(err.stack);
    gracefulExit(1);
  }
}

/**
 * SIGINT / Ctrl+C
 */
process.on('SIGINT', () => {
  console.log('\n\n👋 Пока! Сессия завершена.');
  gracefulExit(0);
});

/**
 * Kill / Docker stop / systemd
 */
process.on('SIGTERM', () => {
  console.log('\n\n🛑 Завершение процесса...');
  gracefulExit(0);
});

/**
 * Необработанные ошибки
 */
process.on('uncaughtException', (err) => {
  console.error('\n💥 Uncaught Exception:', err);
  gracefulExit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('\n💥 Unhandled Rejection:', err);
  gracefulExit(1);
});

// Старт
main();
