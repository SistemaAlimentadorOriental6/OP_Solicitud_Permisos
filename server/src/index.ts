import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env
dotenv.config();

import logger from './config/logger.js';
import performanceMiddleware, { requestLogger } from './middleware/performance.js';
import { testConnection } from './config/database.js';
import { HTTPException } from 'hono/http-exception';
import { type StatusCode } from 'hono/utils/http-status';
import rateLimiter from './middleware/rate-limit.js';  // Importar rate limiter

// Importar rutas
import auth from './routes/auth.js';
import admin from './routes/admin.js';
import permits from './routes/permits.js';
import equipment from './routes/equipment.js';
import excel from './routes/excel.js';
import users from './routes/users.js';
import operator from './routes/operator.js';
import statistics from './routes/statistics.js';
import images from './routes/images.js';
import userContext from './routes/user-context.js';

const app = new Hono();

// Middlewares
app.use('*', cors());
app.use('*', compress());
app.use('*', requestLogger);
app.use('*', performanceMiddleware);
app.use('*', rateLimiter.limit);  // Agregar rate limiter a todas las rutas

// Rutas de la API - El prefijo /api es manejado por el proxy inverso (Nginx/etc)
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/permits', permits);
app.route('/api/equipment', equipment);
app.route('/api/excel', excel);
app.route('/api/users', users);
app.route('/api/operator', operator);
app.route('/api/statistics', statistics);
app.route('/api/images', images);
app.route('/api/user-context', userContext);

// Ruta raíz
app.get('/', (c) => c.text('Servidor Hono funcionando!'));

// Ruta para probar la conexión a la base de datos
app.get('/test-db', async (c) => {
  const isConnected = await testConnection();
  if (isConnected) {
    return c.json({ message: 'Conexión a la base de datos exitosa' });
  } else {
    throw new HTTPException(500, { message: 'Error en la conexión a la base de datos' });
  }
});

// Ruta de salud del servidor
app.get('/health', async (c) => {
  try {
    const isConnected = await testConnection();
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: isConnected ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  } catch (error) {
    logger.error({ error }, 'Error en health check');
    throw new HTTPException(500, { message: 'Servidor no saludable' });
  }
});

// Manejador de errores global
app.onError((err, c) => {
  let status: StatusCode = 500;
  let message = 'Error interno del servidor';

  if (err instanceof HTTPException) {
    status = err.status as StatusCode;
    message = err.message;
  }

  const errorResponse = {
    error: message
  };

  // Loggear el error con el nuevo logger
  logger.error({
    err: err,
    status: status,
    url: c.req.url,
    method: c.req.method
  }, message);

  c.status(status);
  return c.json(errorResponse);
});

// Iniciar servidor
const port = parseInt(process.env.PORT || '8001', 10);

serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  logger.info('🚀 Servidor iniciado');
  logger.info(`✅ Escuchando en http://localhost:${info.port}`);
  logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
}); 