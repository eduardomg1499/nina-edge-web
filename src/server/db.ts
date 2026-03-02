import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data.db');

export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('Administrador', 'Observador'))
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      fecha_hora_inicio TEXT NOT NULL,
      fecha_hora_fin TEXT NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('activa', 'completada', 'cancelada')),
      FOREIGN KEY(id_usuario) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS catalogo_objetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      designacion TEXT NOT NULL,
      ascension_recta TEXT NOT NULL,
      declinacion TEXT NOT NULL,
      url_imagen_referencia TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs_telemetria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_reserva INTEGER NOT NULL,
      comando_ejecutado TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(id_reserva) REFERENCES reservas(id)
    );
  `);

  // Insert default admin user if not exists
  const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@nina.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)').run(
      'Admin', 'admin@nina.com', hash, 'Administrador'
    );
  }

  // Insert default objects if not exists
  const objectsExist = db.prepare('SELECT COUNT(*) as count FROM catalogo_objetos').get() as { count: number };
  if (objectsExist.count === 0) {
    const insertObj = db.prepare('INSERT INTO catalogo_objetos (nombre, designacion, ascension_recta, declinacion, url_imagen_referencia) VALUES (?, ?, ?, ?, ?)');
    insertObj.run('Nebulosa de Orion', 'M42', '05h35m17s', '-05d23m28s', 'https://picsum.photos/seed/m42/800/600');
    insertObj.run('Galaxia de Andromeda', 'M31', '00h42m44s', '+41d16m09s', 'https://picsum.photos/seed/m31/800/600');
    insertObj.run('Cúmulo de las Pleyades', 'M45', '03h47m24s', '+24d07m00s', 'https://picsum.photos/seed/m45/800/600');
  }
}
