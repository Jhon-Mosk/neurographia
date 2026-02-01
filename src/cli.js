'use strict';

const readline = require('node:readline');
const { getNextPhrase, updateStatus, getStats, closeDB } = require('./db');

/**
 * Общая статистика БД
 */
function showOverallStats() {
  const stats = getStats();

  if (!stats.length) return;

  console.log('📈 Общая статистика по уровням:');
  console.log('┌──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Уровень  │ Всего    │ Изучено  │ Осталось │');
  console.log('├──────────┼──────────┼──────────┼──────────┤');

  let total = 0;
  let completedTotal = 0;

  for (const row of stats) {
    total += row.total;
    completedTotal += row.completed;

    const percent = row.total
      ? Math.round((row.completed / row.total) * 100)
      : 0;

    console.log(
      `│ ${row.level.padEnd(8)} │ ${String(row.total).padStart(6)}   │ ${String(row.completed).padStart(6)}   │ ${String(row.remaining).padStart(6)}   │ (${percent}%)`,
    );
  }

  const overallPercent = total ? Math.round((completedTotal / total) * 100) : 0;

  console.log('├──────────┼──────────┼──────────┼──────────┤');
  console.log(
    `│ ИТОГО    │ ${String(total).padStart(6)}   │ ${String(completedTotal).padStart(6)}   │ ${String(total - completedTotal).padStart(6)}   │ (${overallPercent}%)`,
  );
  console.log('└──────────┴──────────┴──────────┴──────────┘\n');
}

/**
 * Ожидание любой клавиши
 */
function waitForKey(prompt = '') {
  if (prompt) console.log(prompt);

  return new Promise((resolve) => {
    const handler = () => {
      process.stdin.off('data', handler);
      resolve();
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.resume();
    process.stdin.once('data', handler);
  });
}

class CLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.sessionStats = {
      total: 0,
      completed: 0,
      skipped: 0,
      startTime: null,
    };
  }

  /**
   * Печать статистики сессии
   */
  #printSessionStats() {
    console.log(`   Всего фраз: ${this.sessionStats.total}`);
    console.log(`   Изучено: ${this.sessionStats.completed}`);
    console.log(`   Отложено: ${this.sessionStats.skipped}`);

    const duration = Math.round(
      (Date.now() - this.sessionStats.startTime) / 1000,
    );

    console.log(`   Время сессии: ${duration} сек\n`);
  }

  /**
   * Сообщение о завершении всех фраз
   */
  #showCompletionMessage() {
    console.log('\n🎉 Поздравляем!');
    console.log('Все фразы на текущих уровнях изучены!\n');

    this.#printSessionStats();
    showOverallStats();
  }

  /**
   * Итоги сессии
   */
  #showSessionSummary() {
    console.log('📊 Итоги сессии:\n');

    this.#printSessionStats();
    showOverallStats();
  }

  /**
   * Корректное завершение
   */
  #cleanup() {
    this.rl.close();
    closeDB();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.exit(0);
  }

  /**
   * Ввод строки
   */
  askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  }

  /**
   * Основной цикл сессии обучения
   */
  async startSession() {
    console.clear();
    console.log('🧠 NeuroEnglish — изучение английских фраз');
    console.log('══════════════════════════════════════════════\n');

    this.sessionStats.startTime = Date.now();

    try {
      while (true) {
        const phrase = getNextPhrase();

        if (!phrase) {
          this.#showCompletionMessage();
          break;
        }

        console.log(`\n📝 Фраза #${this.sessionStats.total + 1}`);
        console.log(`\n🇷🇺 ${phrase.ru}`);
        console.log('\n[Нажмите любую клавишу для показа перевода...]');

        await waitForKey();

        console.log(`\n🇬🇧 ${phrase.en}`);
        console.log('\n──────────────────────────────────────────────');

        let answer;

        while (true) {
          answer = await this.askQuestion('\nИзучено? (y/n) или (q — выход): ');

          if (answer === 'q') {
            console.log('\n🚪 Выход из сессии...\n');
            this.#showSessionSummary();
            return;
          }

          if (['y', 'yes', 'n', 'no'].includes(answer)) break;

          console.log('⚠️ Используйте y/n или q');
        }

        const completed = ['y', 'yes'].includes(answer);

        updateStatus(phrase.id, completed);

        this.sessionStats.total++;

        if (completed) {
          this.sessionStats.completed++;
          console.log('✅ Отмечено как изученное');
        } else {
          this.sessionStats.skipped++;
          console.log('⏭️ Будет показано снова');
        }

        console.log('\n──────────────────────────────────────────────');
      }
    } catch (err) {
      console.error('\n❌ Ошибка сессии:', err.message);
      console.error(err.stack);
    } finally {
      this.#cleanup();
    }
  }
}

// Singleton для удобства использования
const cli = new CLI();

module.exports = {
  startSession: () => cli.startSession(),
};
