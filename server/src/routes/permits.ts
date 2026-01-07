import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PermitRequest2Schema,
  DateCheckSchema,
  PermitRequest2Input,
  DateCheckInput
} from '../schemas/index.js';
import { getCurrentUser } from '../middleware/auth.js';
import { executeQuery } from '../config/database.js';
import { User, FileUpload } from '../types/index.js';
import logger from '../config/logger.js';
import { validateWithZod } from '../utils/validation.js';

type AppEnv = {
  Variables: {
    currentUser: User;
    payload: {
      sub: string;
      iat: number;
      exp: number;
    };
  }
}

const permits = new Hono<AppEnv>();

// Configuración de archivos
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB
const ALLOWED_FILE_TYPES = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

// Asegurar que el directorio de uploads existe
try {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  logger.info({ uploadDir: UPLOAD_DIR }, 'Directorio de uploads creado/verificado exitosamente');
} catch (error) {
  logger.error({ uploadDir: UPLOAD_DIR, error: error instanceof Error ? error.message : String(error) }, 'Error creando directorio de uploads');
}

// Función para crear estructura de carpetas profesional
async function createRequestDirectory(userCode: string, requestId: string, noveltyType: string): Promise<string> {
  try {
    // Crear estructura: uploads/YYYY/MM/cedula/solicitud_ID_tipo/
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    // Sanitizar código de usuario para nombre de carpeta
    const sanitizedUserCode = userCode.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Crear nombre de carpeta de solicitud
    const requestFolderName = `solicitud_${requestId}_${noveltyType}`;

    // Ruta completa: uploads/2024/01/12345678/solicitud_123_cita/
    const requestDir = path.join(UPLOAD_DIR, year, month, sanitizedUserCode, requestFolderName);

    // Crear toda la estructura de directorios
    await fs.mkdir(requestDir, { recursive: true });

    logger.info({
      userCode,
      requestId,
      noveltyType,
      requestDir
    }, 'Estructura de directorios creada exitosamente');

    return requestDir;
  } catch (error) {
    logger.error({
      userCode,
      requestId,
      noveltyType,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error creando estructura de directorios');
    throw new Error(`Error creando directorio para solicitud: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Función para generar nombre de archivo único y descriptivo
function generateFileName(originalName: string, userCode: string, noveltyType: string, index: number): string {
  const timestamp = Date.now();
  const fileExtension = path.extname(originalName);
  const baseName = path.basename(originalName, fileExtension);

  // Sanitizar nombre original
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  const sanitizedUserCode = userCode.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Formato: cedula_tipo_timestamp_indice_nombreOriginal.ext
  return `${sanitizedUserCode}_${noveltyType}_${timestamp}_${index + 1}_${sanitizedBaseName}${fileExtension}`;
}

// Función para obtener ruta relativa para la base de datos
function getRelativeFilePath(fullPath: string): string {
  // Retornar ruta relativa desde el directorio uploads
  return path.relative(UPLOAD_DIR, fullPath).replace(/\\/g, '/');
}

// Función para validar archivo
function validateFile(file: File): string | null {
  if (!file || !file.name) {
    return "Archivo no válido";
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return `El archivo "${file.name}" excede el tamaño máximo de 10MB`;
  }

  // Validar que el archivo no esté vacío
  if (file.size === 0) {
    return `El archivo "${file.name}" está vacío`;
  }

  // Validar tipo MIME
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    // Validar extensión como respaldo
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return `El archivo "${file.name}" no es un tipo válido. Solo se permiten PDF, JPG, JPEG y PNG`;
    }
  }

  // Validar nombre del archivo
  if (file.name.length > 100) {
    return `El nombre del archivo "${file.name}" es demasiado largo`;
  }

  // Validar caracteres especiales en el nombre
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(file.name)) {
    return `El nombre del archivo "${file.name}" contiene caracteres no permitidos`;
  }

  return null;
}

// Función para formatear tamaño de archivo
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// POST /permit-request - Crear solicitud de permiso con archivos (MEJORADO)
permits.post('/permit-request', getCurrentUser, async (c) => {
  const currentUser = c.get('currentUser') as User;
  const startTime = Date.now();

  try {
    logger.info({ userCode: currentUser.code }, 'Iniciando procesamiento de solicitud de permiso');

    const formData = await c.req.formData();

    // Extraer datos del formulario
    const code = formData.get('code') as string;
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const dates = formData.get('dates') as string;
    const noveltyType = formData.get('noveltyType') as string;
    const time = formData.get('time') as string || '';
    const description = formData.get('description') as string;
    const autoApprove = formData.get('autoApprove') as string | null;
    const files = formData.getAll('files') as File[];

    // Extraer metadatos de archivos si existen
    const fileMetadata: any[] = [];
    const filesSummary = formData.get('files_summary') as string;

    // Procesar metadatos de archivos
    for (let i = 0; i < files.length; i++) {
      const metadataStr = formData.get(`file_metadata_${i}`) as string;
      if (metadataStr) {
        try {
          const metadata = JSON.parse(metadataStr);
          fileMetadata.push(metadata);
        } catch (error) {
          logger.warn({ index: i, metadataStr }, 'Error parseando metadatos de archivo');
        }
      }
    }

    // Validar datos requeridos
    if (!code || !name || !dates || !noveltyType) {
      throw new HTTPException(400, { message: 'Faltan campos requeridos: code, name, dates, noveltyType' });
    }

    // Parsear fechas
    let datesList: string[];
    try {
      datesList = JSON.parse(dates);
      if (!Array.isArray(datesList)) {
        throw new Error('dates debe ser un array');
      }
    } catch (error) {
      logger.error({ dates, error }, 'Error parseando fechas');
      throw new HTTPException(400, { message: 'Formato de fechas inválido' });
    }

    // Validar que las fechas no estén vacías para tipos que las requieren
    if (!['semanaAM', 'semanaPM'].includes(noveltyType) && datesList.length === 0) {
      throw new HTTPException(400, { message: 'Debe seleccionar al menos una fecha para este tipo de solicitud' });
    }

    // Los archivos ya no son requeridos para citas médicas o audiencias
    // Comentado porque ya no es necesario adjuntar archivos
    /*
    if ((noveltyType === 'cita' || noveltyType === 'audiencia') && files.length === 0) {
      throw new HTTPException(400, { 
        message: `Para ${noveltyType === 'cita' ? 'citas médicas' : 'audiencias'} es requerido adjuntar al menos un archivo de soporte.` 
      });
    }
    */

    // Validar hora para tipos que la requieren
    if ((noveltyType === 'cita' || noveltyType === 'audiencia') && !time) {
      throw new HTTPException(400, {
        message: `Debe indicar la hora de la ${noveltyType === 'cita' ? 'cita' : 'audiencia'}.`
      });
    }

    // Validación de descripción removida a petición del usuario
    /*
    if ((noveltyType === 'licencia' || noveltyType === 'descanso') && !description?.trim()) {
      throw new HTTPException(400, { 
        message: `Debe proporcionar una descripción para la ${noveltyType === 'licencia' ? 'licencia' : 'descanso'}.` 
      });
    }
    */

    const savedFiles: FileUpload[] = [];
    const fileErrors: string[] = [];
    let requestDirectory: string | null = null;

    // Procesar archivos si existen
    if (files && files.length > 0) {
      logger.info({ fileCount: files.length }, 'Procesando archivos');

      // Crear estructura de directorios profesional usando el ID temporal
      const tempRequestId = `temp_${Date.now()}`;
      try {
        requestDirectory = await createRequestDirectory(currentUser.code, tempRequestId, noveltyType);
      } catch (error) {
        logger.error({ error }, 'Error creando directorio de solicitud');
        throw new HTTPException(500, { message: 'Error creando estructura de directorios' });
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const metadata = fileMetadata[i] || {};

        // Validar archivo
        const validationError = validateFile(file);
        if (validationError) {
          fileErrors.push(validationError);
          logger.warn({ fileName: file.name, error: validationError }, 'Archivo rechazado por validación');
          continue;
        }

        // Generar nombre profesional para el archivo
        const fileName = generateFileName(file.name, currentUser.code, noveltyType, i);
        const filePath = path.join(requestDirectory, fileName);

        try {
          // Guardar archivo en la estructura profesional
          logger.info({ fileName: file.name, filePath, fileSize: file.size }, 'Iniciando guardado de archivo');
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await fs.writeFile(filePath, buffer);
          logger.info({ fileName: file.name, filePath, bufferSize: buffer.length }, 'Archivo escrito exitosamente');

          // Crear objeto de archivo con metadatos y ruta relativa
          const relativePath = getRelativeFilePath(filePath);
          const fileInfo: FileUpload = {
            fileName: fileName,
            fileUrl: relativePath,
            originalName: file.name,
            size: file.size,
            sizeFormatted: formatFileSize(file.size),
            type: file.type,
            uploadTime: new Date().toISOString(),
            metadata: {
              ...metadata,
              userCode: currentUser.code,
              noveltyType: noveltyType,
              requestDirectory: requestDirectory,
              relativePath: relativePath
            }
          };

          savedFiles.push(fileInfo);

          logger.info({
            fileName: file.name,
            savedAs: fileName,
            size: formatFileSize(file.size),
            relativePath: relativePath
          }, 'Archivo guardado exitosamente en estructura profesional');

        } catch (error) {
          logger.error({
            fileName: file.name,
            error: error instanceof Error ? error.message : String(error)
          }, 'Error guardando archivo');

          // Limpieza en caso de error de escritura
          if (requestDirectory) {
            try {
              await fs.rm(requestDirectory, { recursive: true, force: true });
            } catch (cleanupError) {
              logger.error({ err: cleanupError }, 'Error limpiando directorio tras fallo de escritura');
            }
          }
          throw new HTTPException(500, { message: `Error al guardar archivo: ${file.name}` });
        }
      }
    }

    // Si hay errores de archivos, reportarlos
    if (fileErrors.length > 0) {
      logger.warn({ fileErrors }, 'Archivos con errores detectados');
    }

    // Preparar datos para la base de datos
    const filesData = savedFiles.length > 0 ? JSON.stringify(savedFiles) : null;
    const filesSummaryData = filesSummary ? JSON.parse(filesSummary) : null;

    // Preparar arrays de nombres y URLs de archivos
    const fileNames = savedFiles.length > 0 ? JSON.stringify(savedFiles.map(f => f.fileName)) : null;
    const fileUrls = savedFiles.length > 0 ? JSON.stringify(savedFiles.map(f => f.fileUrl)) : null;

    // Determinar el tipo de usuario
    const userType = currentUser.userType || 'registered';

    // Determinar el estado inicial basado en el flag autoApprove
    const initialStatus = (autoApprove === 'true') ? 'approved' : 'pending';

    // Log para rastrear auto-aprobación
    if (autoApprove === 'true') {
      logger.info({
        userCode: currentUser.code,
        noveltyType,
        autoApprove: true
      }, 'Solicitud marcada para auto-aprobación desde panel administrativo');
    }

    // Insertar en la base de datos con todos los datos de archivos incluyendo userType
    const result = await executeQuery(
      `INSERT INTO permit_perms 
       (code, name, telefono, fecha, hora, tipo_novedad, description, files, file_name, file_url, 
        solicitud, notifications, time_created, files_metadata, files_summary, userType)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [
        code,  // Use form data instead of currentUser.code
        name,  // Use form data instead of currentUser.name
        phone || '',
        datesList.join(','),
        time || '',
        noveltyType,
        description || '',
        filesData, // Datos completos de archivos
        fileNames, // Array de nombres de archivos
        fileUrls, // Array de URLs de archivos
        initialStatus, // Estado inicial (approved si autoApprove=true, pending si no)
        '0', // Notificaciones no enviadas
        filesData, // Metadatos de archivos (mismo que files)
        filesSummary ? JSON.stringify(filesSummaryData) : null,
        userType // Tipo de usuario para discriminación
      ],
      { commit: true }
    );

    const requestId = (result as any).insertId;

    // Si hay archivos, renombrar el directorio temporal con el ID real y actualizar la base de datos
    if (savedFiles.length > 0 && requestDirectory) {
      try {
        // Crear el directorio final con el ID real
        const finalRequestDirectory = await createRequestDirectory(currentUser.code, requestId.toString(), noveltyType);

        // Mover archivos del directorio temporal al final
        const updatedFiles: FileUpload[] = [];
        for (let i = 0; i < savedFiles.length; i++) {
          const file = savedFiles[i];
          const oldPath = path.join(requestDirectory, file.fileName);
          const newFileName = generateFileName(file.originalName, currentUser.code, noveltyType, i);
          const newPath = path.join(finalRequestDirectory, newFileName);

          // Mover archivo
          await fs.rename(oldPath, newPath);

          // Actualizar información del archivo
          const relativePath = getRelativeFilePath(newPath);
          const updatedFile: FileUpload = {
            ...file,
            fileName: newFileName,
            fileUrl: relativePath,
            metadata: {
              ...file.metadata,
              requestId: requestId.toString(),
              finalDirectory: finalRequestDirectory,
              relativePath: relativePath
            }
          };
          updatedFiles.push(updatedFile);
        }

        // Eliminar directorio temporal
        try {
          await fs.rm(requestDirectory, { recursive: true, force: true });
        } catch (cleanupError) {
          logger.warn({ cleanupError }, 'Error eliminando directorio temporal');
        }

        // Actualizar base de datos con información correcta de archivos
        const filesData = JSON.stringify(updatedFiles);
        await executeQuery(
          `UPDATE permit_perms SET 
           files = ?, 
           file_name = ?, 
           file_url = ?, 
           files_metadata = ?
           WHERE id = ?`,
          [
            filesData,
            JSON.stringify(updatedFiles.map(f => f.fileName)),
            JSON.stringify(updatedFiles.map(f => f.fileUrl)),
            filesData,
            requestId
          ],
          { commit: true }
        );

        // Actualizar array para respuesta
        savedFiles.length = 0;
        savedFiles.push(...updatedFiles);

        logger.info({
          requestId,
          fileCount: updatedFiles.length,
          finalDirectory: finalRequestDirectory
        }, 'Archivos organizados en estructura profesional final');

      } catch (error) {
        logger.error({
          requestId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error organizando archivos en estructura final');

        // En caso de error, limpiar directorio temporal
        if (requestDirectory) {
          try {
            await fs.rm(requestDirectory, { recursive: true, force: true });
          } catch (cleanupError) {
            logger.error({ cleanupError }, 'Error limpiando directorio temporal tras fallo');
          }
        }
        throw new HTTPException(500, { message: 'Error organizando archivos en estructura final' });
      }
    }

    const processingTime = Date.now() - startTime;

    logger.info({
      userCode: currentUser.code,
      requestId,
      noveltyType,
      dateCount: datesList.length,
      fileCount: savedFiles.length,
      processingTime: `${processingTime}ms`
    }, 'Solicitud de permiso creada exitosamente');

    // Respuesta detallada
    return c.json({
      success: true,
      message: 'Solicitud de permiso creada exitosamente',
      data: {
        id: requestId,
        code: code,
        name: name,
        noveltyType,
        dates: datesList,
        time: time || null,
        description: description || null,
        files: savedFiles.map(f => ({
          fileName: f.fileName,
          originalName: f.originalName,
          size: f.sizeFormatted,
          type: f.type
        })),
        status: initialStatus,
        createdAt: new Date().toISOString()
      },
      summary: {
        totalFiles: savedFiles.length,
        totalSize: savedFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        fileErrors: fileErrors.length,
        processingTime: `${processingTime}ms`
      }
    });

  } catch (dbError) {
    logger.error({
      userCode: currentUser.code,
      error: dbError instanceof Error ? dbError.message : String(dbError),
      stack: dbError instanceof Error ? dbError.stack : undefined
    }, 'Error en base de datos al crear solicitud');

    // Si es un error de HTTPException, re-lanzarlo
    if (dbError instanceof HTTPException) {
      throw dbError;
    }

    // Para otros errores, lanzar error genérico
    throw new HTTPException(500, {
      message: 'Error interno del servidor al procesar la solicitud'
    });
  }
});

// POST /new-permit-request - Crear nueva solicitud de permiso (sin archivos)
permits.post('/new-permit-request', getCurrentUser, async (c) => {
  const currentUser = c.get('currentUser') as User;
  const body = await c.req.json();
  const request: PermitRequest2Input = validateWithZod(PermitRequest2Schema, body);

  // Determinar el tipo de usuario
  const userType = currentUser.userType || 'registered';

  // Insertar en la base de datos incluyendo userType
  const result = await executeQuery(
    `INSERT INTO permit_perms 
     (code, name, telefono, fecha, hora, tipo_novedad, description, solicitud, Aprobado, userType)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      currentUser.code,
      currentUser.name,
      request.phone,
      request.dates.join(','),
      request.time || '',
      request.noveltyType,
      request.description,
      'approved',
      'pendiente',
      userType
    ],
    { commit: true }
  );

  logger.info({
    userCode: request.code,
    requestId: (result as any).insertId
  }, 'Solicitud de permiso sin archivos creada');

  return c.json({
    message: 'Solicitud de permiso creada exitosamente',
    id: (result as any).insertId
  });
});

// GET /files/{*path} - Servir archivos con estructura profesional (MEJORADO)
permits.get('/files/*', async (c) => {
  const filePath = c.req.param('*');

  if (!filePath) {
    throw new HTTPException(400, { message: 'Ruta de archivo requerida' });
  }

  // Validar que la ruta no contenga caracteres peligrosos
  if (filePath.includes('..')) {
    throw new HTTPException(400, { message: 'Ruta de archivo inválida' });
  }

  // Normalizar la ruta para Windows
  const normalizedPath = filePath.replace(/\//g, path.sep);
  const fullFilePath = path.join(UPLOAD_DIR, normalizedPath);

  try {
    // Verificar que el archivo existe y está dentro del directorio de uploads
    const resolvedPath = path.resolve(fullFilePath);
    const uploadDirResolved = path.resolve(UPLOAD_DIR);

    if (!resolvedPath.startsWith(uploadDirResolved)) {
      throw new HTTPException(403, { message: 'Acceso denegado' });
    }

    const stats = await fs.stat(resolvedPath);

    // Verificar que es un archivo (no un directorio)
    if (!stats.isFile()) {
      throw new HTTPException(404, { message: 'Archivo no encontrado' });
    }

    // Leer archivo y enviarlo como stream
    const fileBuffer = await fs.readFile(resolvedPath);
    const filename = path.basename(resolvedPath);
    const mimeType = getMimeType(filename);

    logger.info({
      filePath,
      resolvedPath,
      size: formatFileSize(fileBuffer.length),
      mimeType
    }, 'Archivo servido exitosamente desde estructura profesional');

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': `inline; filename="${filename}"`
      }
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error({
      filePath,
      fullFilePath,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error sirviendo archivo desde estructura profesional');

    throw new HTTPException(404, { message: 'Archivo no encontrado' });
  }
});

// POST /check-existing-requests - Verificar solicitudes existentes
permits.post('/check-existing-requests', getCurrentUser, async (c) => {
  const currentUser = c.get('currentUser') as User;
  const body = await c.req.json();
  const { dates }: DateCheckInput = validateWithZod(DateCheckSchema, body);

  // Obtener rango de fechas (miércoles a miércoles)
  const today = new Date();
  const lastWednesday = new Date(today);
  lastWednesday.setDate(today.getDate() - ((today.getDay() + 4) % 7));

  const nextWednesday = new Date(lastWednesday);
  nextWednesday.setDate(lastWednesday.getDate() + 7);

  // Filtrar fechas dentro del rango
  const checkDates = dates.map(date => new Date(date));
  const filteredDates = checkDates.filter(date =>
    date >= lastWednesday && date < nextWednesday
  );

  if (filteredDates.length === 0) {
    return c.json({ hasExistingRequest: false });
  }

  // Verificar solicitudes existentes
  const dateStrings = filteredDates.map(date => date.toISOString().split('T')[0]);
  const placeholders = dateStrings.map(() => '?').join(',');

  const result = await executeQuery<{ count: number }>(
    `SELECT COUNT(*) as count 
     FROM permit_perms 
     WHERE code = ? AND fecha IN (${placeholders}) AND solicitud != 'rejected'`,
    [currentUser.code, ...dateStrings],
    { fetchOne: true }
  );

  return c.json({ hasExistingRequest: (result?.count || 0) > 0 });
});

// POST /check-existing-permits - Verificar permisos existentes por fecha específica (MEJORADO)
permits.post('/check-existing-permits', getCurrentUser, async (c) => {
  const currentUser = c.get('currentUser') as User;
  const body = await c.req.json();
  const { dates, noveltyType }: { dates: string[], noveltyType: string } = body;

  if (!dates || dates.length === 0 || !noveltyType) {
    return c.json({ hasExistingPermit: false, existingDates: [] });
  }

  try {
    const dateStrings = dates.map(date => new Date(date).toISOString().split('T')[0]);

    // Traer todas las filas del usuario con ese tipo de novedad
    const result = await executeQuery<any[]>(
      `SELECT fecha, tipo_novedad, solicitud FROM permit_perms 
       WHERE code = ? AND tipo_novedad = ? AND solicitud != 'rejected'`,
      [currentUser.code, noveltyType],
      { fetchAll: true }
    );

    let existingDates: string[] = [];
    for (const row of result || []) {
      if (row && row.fecha) {
        const fechas = row.fecha.split(',').map((f: string) => f.trim());
        existingDates.push(...fechas.filter((f: string) => dateStrings.includes(f)));
      }
    }

    // Eliminar duplicados
    existingDates = [...new Set(existingDates)];

    logger.info({
      userCode: currentUser.code,
      noveltyType,
      checkDates: dateStrings,
      existingDates,
      hasConflict: existingDates.length > 0
    }, 'Verificación de permisos existentes completada');

    return c.json({
      hasExistingPermit: existingDates.length > 0,
      existingDates,
      checkedDates: dateStrings,
      noveltyType
    });

  } catch (error) {
    logger.error({
      userCode: currentUser.code,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error verificando permisos existentes');

    throw new HTTPException(500, {
      message: 'Error al verificar permisos existentes'
    });
  }
});

// GET /permit-request/{id} - Obtener solicitud específica (MEJORADO)
permits.get('/permit-request/:id', async (c) => {
  const id = parseInt(c.req.param('id') || '0', 10);

  if (!id) {
    throw new HTTPException(400, { message: 'ID de solicitud requerido' });
  }

  try {
    const request = await executeQuery(
      'SELECT * FROM permit_perms WHERE id = ?',
      [id],
      { fetchOne: true }
    );

    if (!request) {
      throw new HTTPException(404, { message: 'Solicitud no encontrada' });
    }

    // Procesar archivos si existen
    if (request.files) {
      try {
        request.files = JSON.parse(request.files);
      } catch (error) {
        logger.warn({ requestId: id, files: request.files }, 'Error parseando archivos');
        request.files = [];
      }
    }

    // Procesar metadatos si existen
    if (request.files_metadata) {
      try {
        request.files_metadata = JSON.parse(request.files_metadata);
      } catch (error) {
        logger.warn({ requestId: id }, 'Error parseando metadatos de archivos');
        request.files_metadata = null;
      }
    }

    // Procesar resumen si existe
    if (request.files_summary) {
      try {
        request.files_summary = JSON.parse(request.files_summary);
      } catch (error) {
        logger.warn({ requestId: id }, 'Error parseando resumen de archivos');
        request.files_summary = null;
      }
    }

    logger.info({ requestId: id }, 'Solicitud obtenida exitosamente');

    return c.json(request);

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error({
      requestId: id,
      error: error instanceof Error ? error.message : String(error)
    }, 'Error obteniendo solicitud');

    throw new HTTPException(500, {
      message: 'Error interno del servidor al obtener la solicitud'
    });
  }
});

// Función auxiliar para obtener tipo MIME
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export default permits;