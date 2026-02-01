'use strict';

const path = require('node:path');
const fsp = require('node:fs/promises');
const Database = require('better-sqlite3');

// Путь к файлу с фразами
const DB_PATH = path.join(__dirname, '..', 'db', 'phrases.db');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

class PhraseDB {
  constructor() {
    this.db = null;
    this.statements = {};
  }

  /**
   * Создание таблиц, индексов, триггеров
   */
  #initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS phrases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ru TEXT NOT NULL CHECK(length(ru) > 0),
        en TEXT NOT NULL CHECK(length(en) > 0),
        level TEXT NOT NULL CHECK(level IN ('A1','A2','B1','B2','C1','C2')),
        completed BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_priority
      ON phrases(completed, level, updated_at);

      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON phrases
      BEGIN
        UPDATE phrases
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
      END;
    `);
  }

  /**
   * Подготовка prepared statements
   */
  #prepareStatements() {
    this.statements.insertPhrase = this.db.prepare(`
      INSERT INTO phrases (ru, en, level, completed)
      VALUES (?, ?, ?, 0)
    `);

    this.statements.getAllPhrases = this.db.prepare(`
      SELECT ru, en, level FROM phrases
    `);

    this.statements.getNextPhrase = this.db.prepare(`
      SELECT * FROM phrases
      WHERE completed = 0
      ORDER BY
        CASE level
          WHEN 'A1' THEN 1
          WHEN 'A2' THEN 2
          WHEN 'B1' THEN 3
          WHEN 'B2' THEN 4
          WHEN 'C1' THEN 5
          WHEN 'C2' THEN 6
        END,
        updated_at
      LIMIT 1
    `);

    this.statements.updateStatus = this.db.prepare(`
      UPDATE phrases
      SET completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.statements.getStats = this.db.prepare(`
      SELECT
        level,
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as remaining
      FROM phrases
      GROUP BY level
      ORDER BY
        CASE level
          WHEN 'A1' THEN 1
          WHEN 'A2' THEN 2
          WHEN 'B1' THEN 3
          WHEN 'B2' THEN 4
          WHEN 'C1' THEN 5
          ELSE 6
        END
    `);
  }

  /**
   * Инициализация подключения и схемы
   */
  async init() {
    await fsp.mkdir(path.dirname(DB_PATH), { recursive: true });

    this.db = new Database(DB_PATH, {
      fileMustExist: false,
    });

    // Оптимальные PRAGMA
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    // Блокировка двойного запуска
    this.db.pragma('locking_mode = EXCLUSIVE');

    this.#initSchema();
    this.#prepareStatements();

    return this;
  }

  /**
   * Импорт фраз из JSON (идемпотентный)
   */
  async importPhrases(jsonPath) {
    const rawData = await fsp.readFile(jsonPath, 'utf8');
    const phrases = JSON.parse(rawData);

    if (!Array.isArray(phrases)) {
      throw new Error('JSON должен содержать массив');
    }

    const validPhrases = phrases.filter(
      (p) => p.ru && p.en && LEVELS.includes(p.level),
    );

    if (!validPhrases.length) {
      console.warn('⚠️ Нет валидных фраз для импорта');
      return;
    }

    const existing = this.statements.getAllPhrases.all();

    const existingSet = new Set(
      existing.map((p) => `${p.ru}|${p.en}|${p.level}`),
    );

    let inserted = 0;
    let skipped = 0;

    // Транзакция = ОЧЕНЬ важно для скорости
    const insertTx = this.db.transaction((phrases) => {
      for (const phrase of phrases) {
        const key = `${phrase.ru}|${phrase.en}|${phrase.level}`;

        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        this.statements.insertPhrase.run(phrase.ru, phrase.en, phrase.level);

        inserted++;
      }
    });

    insertTx(validPhrases);

    console.log(
      `✅ Импорт завершён: ${inserted} добавлено, ${skipped} пропущено`,
    );
  }

  /**
   * Получить следующую фразу
   */
  getNextPhrase() {
    return this.statements.getNextPhrase.get() || null;
  }

  /**
   * Обновить статус
   */
  updateStatus(id, completed) {
    const result = this.statements.updateStatus.run(completed ? 1 : 0, id);

    return {
      id,
      changes: result.changes,
    };
  }

  /**
   * Получить статистику
   */
  getStats() {
    return this.statements.getStats.all();
  }

  /**
   * Закрытие БД
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton-экземпляр для удобства использования
const dbInstance = new PhraseDB();

module.exports = {
  initDB: () => dbInstance.init(),
  importPhrases: (path) => dbInstance.importPhrases(path),
  getNextPhrase: () => dbInstance.getNextPhrase(),
  updateStatus: (id, completed) => dbInstance.updateStatus(id, completed),
  getStats: () => dbInstance.getStats(),
  closeDB: () => dbInstance.close(),
  // Для тестов и расширенного использования
  getInstance: () => dbInstance,
};
