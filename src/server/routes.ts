import { Express } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-nina';

export function setupRoutes(app: Express) {
  // Auth routes
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  });

  // Middleware to verify token
  const verifyToken = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'Token requerido' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token invalido' });
    }
  };

  // Users routes
  app.get('/api/users', verifyToken, (req: any, res: any) => {
    if (req.user.rol !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
    const users = db.prepare('SELECT id, nombre, email, rol FROM usuarios').all();
    res.json(users);
  });

  app.post('/api/users', verifyToken, (req: any, res: any) => {
    if (req.user.rol !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
    const { nombre, email, password, rol } = req.body;
    try {
      const hash = bcrypt.hashSync(password, 10);
      const result = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)').run(nombre, email, hash, rol);
      res.json({ id: result.lastInsertRowid, nombre, email, rol });
    } catch (err) {
      res.status(400).json({ error: 'Error al crear usuario' });
    }
  });

  app.delete('/api/users/:id', verifyToken, (req: any, res: any) => {
    if (req.user.rol !== 'Administrador') return res.status(403).json({ error: 'Acceso denegado' });
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Reservations routes
  app.get('/api/reservations/active', verifyToken, (req: any, res: any) => {
    const now = new Date().toISOString();
    const active = db.prepare(`
      SELECT * FROM reservas 
      WHERE id_usuario = ? 
      AND estado != 'cancelada'
      AND fecha_hora_inicio <= ? 
      AND fecha_hora_fin >= ?
    `).get(req.user.id, now, now);
    res.json(active || null);
  });

  app.get('/api/reservations', verifyToken, (req: any, res: any) => {
    const reservations = db.prepare(`
      SELECT r.*, u.nombre as usuario_nombre 
      FROM reservas r 
      JOIN usuarios u ON r.id_usuario = u.id
    `).all();
    res.json(reservations);
  });

  app.post('/api/reservations', verifyToken, (req: any, res: any) => {
    const { fecha_hora_inicio, fecha_hora_fin } = req.body;
    
    // Check overlaps
    const overlap = db.prepare(`
      SELECT id FROM reservas 
      WHERE estado != 'cancelada' 
      AND (
        (fecha_hora_inicio <= ? AND fecha_hora_fin > ?) OR
        (fecha_hora_inicio < ? AND fecha_hora_fin >= ?) OR
        (fecha_hora_inicio >= ? AND fecha_hora_fin <= ?)
      )
    `).get(fecha_hora_inicio, fecha_hora_inicio, fecha_hora_fin, fecha_hora_fin, fecha_hora_inicio, fecha_hora_fin);

    if (overlap) {
      return res.status(400).json({ error: 'El horario seleccionado se superpone con una reserva existente' });
    }

    try {
      const result = db.prepare('INSERT INTO reservas (id_usuario, fecha_hora_inicio, fecha_hora_fin, estado) VALUES (?, ?, ?, ?)').run(
        req.user.id, fecha_hora_inicio, fecha_hora_fin, 'activa'
      );
      res.json({ id: result.lastInsertRowid, id_usuario: req.user.id, fecha_hora_inicio, fecha_hora_fin, estado: 'activa' });
    } catch (err) {
      res.status(400).json({ error: 'Error al crear reserva' });
    }
  });

  app.delete('/api/reservations/:id', verifyToken, (req: any, res: any) => {
    const reservation = db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id) as any;
    if (!reservation) return res.status(404).json({ error: 'Reserva no encontrada' });
    
    if (req.user.rol !== 'Administrador' && reservation.id_usuario !== req.user.id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    db.prepare('UPDATE reservas SET estado = ? WHERE id = ?').run('cancelada', req.params.id);
    res.json({ success: true });
  });

  // Catalog routes
  app.get('/api/catalog', verifyToken, (req: any, res: any) => {
    const objects = db.prepare('SELECT * FROM catalogo_objetos').all();
    res.json(objects);
  });
}
