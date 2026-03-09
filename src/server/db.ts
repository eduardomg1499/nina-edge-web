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

    CREATE TABLE IF NOT EXISTS aprobaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      id_objeto INTEGER NOT NULL,
      estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'aprobado', 'rechazado')),
      timestamp TEXT NOT NULL,
      FOREIGN KEY(id_usuario) REFERENCES usuarios(id),
      FOREIGN KEY(id_objeto) REFERENCES catalogo_objetos(id)
    );
  `);

  try {
    db.exec("ALTER TABLE catalogo_objetos ADD COLUMN requiere_aprobacion BOOLEAN DEFAULT 0");
  } catch (e) {
    // Column already exists
  }

  // Insert default admin user if not exists
  const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@nina.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)').run(
      'Admin', 'admin@nina.com', hash, 'Administrador'
    );
  }

  // Insert default observer user if not exists
  const observerExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('invitado@nina.com');
  if (!observerExists) {
    const hash = bcrypt.hashSync('invitado123', 10);
    db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)').run(
      'Invitado (Observador)', 'invitado@nina.com', hash, 'Observador'
    );
  }

  // Insert default objects if not exists
  const objectsExist = db.prepare('SELECT COUNT(*) as count FROM catalogo_objetos').get() as { count: number };
  if (objectsExist.count === 0) {
    const insertObj = db.prepare('INSERT INTO catalogo_objetos (nombre, designacion, ascension_recta, declinacion, url_imagen_referencia, requiere_aprobacion) VALUES (?, ?, ?, ?, ?, ?)');
    insertObj.run('Nebulosa de Orion', 'M42', '05h35m17s', '-05d23m28s', 'https://picsum.photos/seed/m42/800/600', 0);
    insertObj.run('Galaxia de Andromeda', 'M31', '00h42m44s', '+41d16m09s', 'https://picsum.photos/seed/m31/800/600', 0);
    insertObj.run('Cúmulo de las Pleyades', 'M45', '03h47m24s', '+24d07m00s', 'https://picsum.photos/seed/m45/800/600', 0);
  }

  // Update existing objects with real images
  db.exec(`
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg/800px-Orion_Nebula_-_Hubble_2006_mosaic_18000.jpg' WHERE designacion = 'M42';
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/800px-Andromeda_Galaxy_%28with_h-alpha%29.jpg' WHERE designacion = 'M31';
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Pleiades_large.jpg/800px-Pleiades_large.jpg' WHERE designacion = 'M45';
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/M101_hires_STScI-PRC2006-10a.jpg/800px-M101_hires_STScI-PRC2006-10a.jpg' WHERE designacion = 'M101';
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/M104_ngc4594_sombrero_galaxy_hi-res.jpg/800px-M104_ngc4594_sombrero_galaxy_hi-res.jpg' WHERE designacion = 'M104';
    UPDATE catalogo_objetos SET url_imagen_referencia = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/800px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg' WHERE designacion = 'Sol';
  `);

  const insertObj = db.prepare('INSERT INTO catalogo_objetos (nombre, designacion, ascension_recta, declinacion, url_imagen_referencia, requiere_aprobacion) VALUES (?, ?, ?, ?, ?, ?)');
  
  const m101Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M101');
  if (!m101Exists) {
    insertObj.run('Galaxia del Molinete', 'M101', '14h03m12s', '+54d20m56s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/M101_hires_STScI-PRC2006-10a.jpg/800px-M101_hires_STScI-PRC2006-10a.jpg', 0);
  }
  
  const m104Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M104');
  if (!m104Exists) {
    insertObj.run('Galaxia del Sombrero', 'M104', '12h39m59s', '-11d37m23s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/M104_ngc4594_sombrero_galaxy_hi-res.jpg/800px-M104_ngc4594_sombrero_galaxy_hi-res.jpg', 0);
  }
  
  const solExists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('Sol');
  if (!solExists) {
    insertObj.run('El Sol', 'Sol', '00h00m00s', '+00d00m00s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg/800px-The_Sun_by_the_Atmospheric_Imaging_Assembly_of_NASA%27s_Solar_Dynamics_Observatory_-_20100819.jpg', 1);
  }

  // New Spring/Summer objects
  const m8Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M8');
  if (!m8Exists) {
    insertObj.run('Nebulosa de la Laguna', 'M8', '18h03m37s', '-24d23m12s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Lagoon_Nebula_%28M8%29.jpg/800px-Lagoon_Nebula_%28M8%29.jpg', 0);
  }

  const m20Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M20');
  if (!m20Exists) {
    insertObj.run('Nebulosa Trifida', 'M20', '18h02m23s', '-22d58m18s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Trifid_Nebula_by_Hubble.jpg/800px-Trifid_Nebula_by_Hubble.jpg', 0);
  }

  const m13Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M13');
  if (!m13Exists) {
    insertObj.run('Cumulo de Hercules', 'M13', '16h41m41s', '+36d27m35s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Messier_13_by_Hubble.jpg/800px-Messier_13_by_Hubble.jpg', 0);
  }

  const m57Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M57');
  if (!m57Exists) {
    insertObj.run('Nebulosa del Anillo', 'M57', '18h53m35s', '+33d01m45s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/M57_The_Ring_Nebula.JPG/800px-M57_The_Ring_Nebula.JPG', 0);
  }

  const m51Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M51');
  if (!m51Exists) {
    insertObj.run('Galaxia del Remolino', 'M51', '13h29m52s', '+47d11m43s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Messier51_sRGB.jpg/800px-Messier51_sRGB.jpg', 0);
  }

  const m16Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M16');
  if (!m16Exists) {
    insertObj.run('Nebulosa del Aguila', 'M16', '18h18m48s', '-13d49m00s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Eagle_Nebula_from_ESO.jpg/800px-Eagle_Nebula_from_ESO.jpg', 0);
  }

  const m27Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M27');
  if (!m27Exists) {
    insertObj.run('Nebulosa Dumbbell', 'M27', '19h59m36s', '+22d43m16s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/M27_-_Dumbbell_Nebula.jpg/800px-M27_-_Dumbbell_Nebula.jpg', 0);
  }

  const m81Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M81');
  if (!m81Exists) {
    insertObj.run('Galaxia de Bode', 'M81', '09h55m33s', '+69d03m55s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Messier_81_HST.jpg/800px-Messier_81_HST.jpg', 0);
  }

  const m82Exists = db.prepare('SELECT id FROM catalogo_objetos WHERE designacion = ?').get('M82');
  if (!m82Exists) {
    insertObj.run('Galaxia del Cigarro', 'M82', '09h55m52s', '+69d40m47s', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/M82_HST_ACS_2006-14-a-large_web.jpg/800px-M82_HST_ACS_2006-14-a-large_web.jpg', 0);
  }
}
