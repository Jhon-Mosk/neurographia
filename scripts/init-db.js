#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const { initDB, importPhrases, getStats, closeDB } = require('#root/src/db.js');

// Путь к файлу с фразами
const PHRASES_PATH = path.join(__dirname, '..', 'data', 'phrases.json');

/**
 * Проверка существования файла
 */
async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Создание sample-файла
 */
async function createSampleFile() {
  console.warn(`⚠️ Файл с фразами не найден: ${PHRASES_PATH}`);
  console.log('💡 Создаю пример файла...\n');

  const sampleData = [
    { ru: 'Привет', en: 'Hello', level: 'A1' },
    { ru: 'Как дела?', en: 'How are you?', level: 'A1' },
    { ru: 'Спасибо', en: 'Thank you', level: 'A1' },
    { ru: 'Пожалуйста', en: 'You are welcome', level: 'A1' },
    { ru: 'Меня зовут...', en: 'My name is...', level: 'A1' },
    { ru: 'Где туалет?', en: 'Where is the toilet?', level: 'A2' },
    { ru: 'Сколько это стоит?', en: 'How much does it cost?', level: 'A2' },
    { ru: 'Я не понимаю', en: "I don't understand", level: 'A2' },
    { ru: 'Могу я помочь вам?', en: 'Can I help you?', level: 'B1' },
    {
      ru: 'Это зависит от обстоятельств',
      en: 'It depends on the circumstances',
      level: 'B2',
    },
  ];

  await fsp.mkdir(path.dirname(PHRASES_PATH), { recursive: true });
  await fsp.writeFile(
    PHRASES_PATH,
    JSON.stringify(sampleData, null, 2),
    'utf8',
  );

  console.log(`✅ Создан файл: ${PHRASES_PATH}\n`);
}

/**
 * Вывод подсказки после создания файла
 */
function printAfterCreateMessage() {
  console.log('📝 Заполните файл своими фразами и запустите снова.\n');
}

/**
 * Вывод статистики
 */
function showStats() {
  const stats = getStats();

  if (!stats.length) {
    console.log('📊 Статистика: База данных пуста\n');
    return;
  }

  console.log('📊 Статистика по уровням:');
  console.log('┌──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Уровень  │ Всего    │ Изучено  │ Осталось │');
  console.log('├──────────┼──────────┼──────────┼──────────┤');

  let total = 0;
  let completedTotal = 0;

  for (const row of stats) {
    total += row.total;
    completedTotal += row.completed;

    console.log(
      `│ ${row.level.padEnd(8)} │ ${String(row.total).padStart(6)}   │ ${String(row.completed).padStart(6)}   │ ${String(row.remaining).padStart(6)}   │`,
    );
  }

  console.log('├──────────┼──────────┼──────────┼──────────┤');
  console.log(
    `│ ИТОГО    │ ${String(total).padStart(6)}   │ ${String(completedTotal).padStart(6)}   │ ${String(total - completedTotal).padStart(6)}   │`,
  );
  console.log('└──────────┴──────────┴──────────┴──────────┘');
}

async function initDatabase() {
  console.log('🔧 Инициализация базы данных...\n');

  try {
    // Инициализация БД
    await initDB();
    console.log('✅ База данных инициализирована');

    // Проверка существования файла с фразами
    const fileExists = await exists(PHRASES_PATH);

    if (!fileExists) {
      await createSampleFile();
      printAfterCreateMessage();
      showStats();
      closeDB();
      process.exit(0);
    }

    // Импорт фраз
    console.log(`📥 Импорт фраз из: ${PHRASES_PATH}`);
    await importPhrases(PHRASES_PATH);
    console.log('✅ Фразы импортированы\n');

    // Показать статистику
    showStats();

    console.log('\n✨ Инициализация завершена успешно!');
    console.log('➡️  Запустите обучение: npm start\n');
  } catch (err) {
    console.error(`❌ Ошибка инициализации: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    closeDB();
  }
}

// Запуск скрипта
initDatabase();
