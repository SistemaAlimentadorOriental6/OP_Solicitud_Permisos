import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  ApprovalUpdateSchema,
  NotificationStatusUpdateSchema,
  RequestUpdateSchema,
  ApprovalUpdateInput,
  NotificationStatusUpdateInput,
  RequestUpdateInput
} from '../schemas/index.js';
import { getCurrentUser } from '../middleware/auth.js';
import {
  enrichUserWithPermissions,
  requirePermission,
  requireAdmin,
  requireAnyPermission,
  UserContext
} from '../middleware/permissions.js';
import { userHasPermission } from '../config/permissions.js';
import { getEmployeeFromSE, getEmployeeFromOperations, getMaintenanceEmployees } from '../config/sqlserver.js';
import { getConnection, executeQuery } from '../config/database.js';
import logger from '../config/logger.js';
import { User, HistoryRecord } from '../types/index.js';
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

const admin = new Hono<AppEnv>();

// Apply permission enrichment to all admin routes
admin.use('*', getCurrentUser, enrichUserWithPermissions);

// GET // Endpoint de diagnóstico para analizar datos de mantenimiento
admin.get('/maintenance-diagnostic', requirePermission('maintenance:diagnostic'), async (c) => {
  try {
    const { getSqlServerConnection } = await import('../config/sqlserver.js');
    const pool = await getSqlServerConnection();

    // Consultas de diagnóstico
    const diagnosticResult = await pool.request()
      .query(`
        -- Diagnóstico: Total de registros sin filtros
        SELECT 'Total registros' as tipo, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550
        
        UNION ALL
        
        -- Registros con centros de costo de mantenimiento (exacto)
        SELECT 'Con centros exactos' as tipo, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE f_desc_Ccosto = 'Tecnicos de Mantenimiento' OR f_desc_Ccosto = 'Gestion de Mantenimiento'
        
        UNION ALL
        
        -- Registros con centros de costo que contienen las palabras (por si hay espacios extra)
        SELECT 'Con centros LIKE' as tipo, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE f_desc_Ccosto LIKE '%Tecnicos de Mantenimiento%' OR f_desc_Ccosto LIKE '%Gestion de Mantenimiento%'
        
        UNION ALL
        
        -- Registros activos (sin fecha de retiro o fecha futura)
        SELECT 'Activos total' as tipo, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE f_fecha_retiro IS NULL OR f_fecha_retiro > GETDATE()
        
        UNION ALL
        
        -- Registros de mantenimiento activos
        SELECT 'Mantenimiento activos' as tipo, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE (f_desc_Ccosto LIKE '%Tecnicos de Mantenimiento%' OR f_desc_Ccosto LIKE '%Gestion de Mantenimiento%')
        AND (f_fecha_retiro IS NULL OR f_fecha_retiro > GETDATE())
        
        UNION ALL
        
        -- Empleados únicos por empleado
        SELECT 'Empleados únicos mantenimiento activos' as tipo, COUNT(DISTINCT f_nit_empl) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE (f_desc_Ccosto LIKE '%Tecnicos de Mantenimiento%' OR f_desc_Ccosto LIKE '%Gestion de Mantenimiento%')
        AND (f_fecha_retiro IS NULL OR f_fecha_retiro > GETDATE())
      `);

    const costCenterResult = await pool.request()
      .query(`
        SELECT DISTINCT f_desc_Ccosto, COUNT(*) as cantidad
        FROM UNOEE.dbo.SE_w0550 
        WHERE f_desc_Ccosto LIKE '%Mantenimiento%' OR f_desc_Ccosto LIKE '%mantenimiento%'
        GROUP BY f_desc_Ccosto
        ORDER BY cantidad DESC
      `);

    return c.json({
      success: true,
      diagnostic: diagnosticResult.recordset,
      costCenters: costCenterResult.recordset
    });
  } catch (error) {
    logger.error('Error en diagnóstico de mantenimiento', { error: error instanceof Error ? error.message : String(error) });
    return c.json({ success: false, message: 'Error interno del servidor' }, 500);
  }
});

// GET // Endpoint para obtener empleados de mantenimiento
admin.get('/maintenance-employees', requirePermission('maintenance:read'), async (c) => {
  try {
    logger.info('Obteniendo empleados de mantenimiento desde SQL Server');
    const employees = await getMaintenanceEmployees();
    return c.json({ success: true, data: employees, total: employees.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error({ error: errorMessage }, 'Error al obtener empleados de mantenimiento');
    return c.json({
      success: false,
      message: 'Error al obtener empleados de mantenimiento',
      error: errorMessage
    }, 500);
  }
});

// POST /search-employee-by-cedula - Buscar empleado por cédula en SQL Server (Mantenimiento)
admin.post('/search-employee-by-cedula', requirePermission('maintenance:search'), async (c) => {
  try {
    const body = await c.req.json();
    const { cedula } = body;

    if (!cedula || !cedula.trim()) {
      throw new HTTPException(400, { message: 'Cédula es requerida' });
    }

    logger.info({ cedula }, 'Buscando empleado por cédula en SQL Server');

    // Buscar empleado usando la función existente
    const employee = await getEmployeeFromSE(cedula.trim());

    if (!employee) {
      throw new HTTPException(404, { message: 'Empleado no encontrado' });
    }

    logger.info({ cedula, employeeName: employee.nombre }, 'Empleado encontrado exitosamente');

    return c.json({
      success: true,
      data: employee,
      message: 'Empleado encontrado exitosamente'
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error({ error: errorMessage }, 'Error al buscar empleado por cédula');

    return c.json({
      success: false,
      message: 'Error al buscar empleado en la base de datos',
      error: errorMessage
    }, 500);
  }
});

// POST /search-employee-operations - Buscar empleado por cédula en centro de costo "Gestion de Operaciones"
admin.post('/search-employee-operations', requirePermission('operations:search'), async (c) => {
  try {
    const body = await c.req.json();
    const { cedula } = body;

    if (!cedula || !cedula.trim()) {
      throw new HTTPException(400, { message: 'Cédula es requerida' });
    }

    logger.info({ cedula }, 'Buscando empleado de operaciones por cédula en SQL Server');

    // Buscar empleado en centro de costo "Gestion de Operaciones"
    const employee = await getEmployeeFromOperations(cedula.trim());

    if (!employee) {
      throw new HTTPException(404, { message: 'Empleado no encontrado en Gestión de Operaciones' });
    }

    logger.info({ cedula, employeeName: employee.f_nombre_empl }, 'Empleado de operaciones encontrado exitosamente');

    return c.json({
      success: true,
      data: employee,
      message: 'Empleado de operaciones encontrado exitosamente'
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error({ error: errorMessage }, 'Error al buscar empleado de operaciones por cédula');

    return c.json({
      success: false,
      message: 'Error al buscar empleado de operaciones en la base de datos',
      error: errorMessage
    }, 500);
  }
});

// GET /requests - Obtener todas las solicitudes con paginación (requiere autenticación de admin)
admin.get('/requests', requireAnyPermission(['requests:read', 'requests:read_own']), async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    let limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Obtener el usuario actual del contexto con permisos enriquecidos
    const currentUser = c.get('currentUser') as UserContext;

    // Obtener filtros de fecha desde los query parameters
    const dateFrom = c.req.query('dateFrom');
    const dateTo = c.req.query('dateTo');
    const status = c.req.query('status');
    const type = c.req.query('type');
    const department = c.req.query('department');
    const priority = c.req.query('priority');

    // Aplicar filtrado basado en permisos
    const canReadAllRequests = userHasPermission(currentUser, 'requests:read');
    const canFilterAllTypes = userHasPermission(currentUser, 'requests:filter_all');
    const shouldFilterByUserCode = !canReadAllRequests && userHasPermission(currentUser, 'requests:read_own');

    // Determinar userType basado en permisos
    let userType;
    if (canReadAllRequests && canFilterAllTypes) {
      userType = c.req.query('userType'); // Admin puede ver todos los tipos
    } else if (canReadAllRequests && !canFilterAllTypes) {
      userType = currentUser?.userType; // Puede ver todas las requests pero solo de su tipo
    } else {
      userType = currentUser?.userType; // Solo puede ver sus propias requests
    }

    logger.info({ page, limit, offset, dateFrom, dateTo, status, type, department, priority, userType }, 'Obteniendo solicitudes con paginación y filtros');

    // --- NUEVO: Separar condiciones y parámetros para cada tabla ---
    // permit_perms
    let wherePerms: string[] = [];
    let paramsPerms: any[] = [];
    let dateFilterPerms = '';
    if (dateFrom || dateTo) {
      let dateConditions: string[] = [];

      // Si ambas fechas son iguales, buscar registros de ese día específico
      if (dateFrom && dateTo && dateFrom === dateTo) {
        dateConditions.push(`(
          p.fecha IS NOT NULL AND (
            DATE(p.fecha) = ? OR
            p.fecha LIKE CONCAT(?, ',%') OR
            p.fecha LIKE CONCAT('%,', ?) OR
            p.fecha LIKE CONCAT('%,', ?, ',%')
          )
        )`);
        paramsPerms.push(dateFrom, dateFrom, dateFrom, dateFrom);
      } else {
        // Lógica para rango de fechas
        if (dateFrom) {
          dateConditions.push(`(
            p.fecha IS NOT NULL AND (
              DATE(p.fecha) >= ? OR
              p.fecha LIKE CONCAT(?, ',%') OR
              p.fecha LIKE CONCAT('%,', ?) OR
              p.fecha LIKE CONCAT('%,', ?, ',%')
            )
          )`);
          paramsPerms.push(dateFrom, dateFrom, dateFrom, dateFrom);
        }
        if (dateTo) {
          dateConditions.push(`(
            p.fecha IS NOT NULL AND (
              DATE(p.fecha) <= ? OR
              p.fecha LIKE CONCAT(?, ',%') OR
              p.fecha LIKE CONCAT('%,', ?) OR
              p.fecha LIKE CONCAT('%,', ?, ',%')
            )
          )`);
          paramsPerms.push(dateTo, dateTo, dateTo, dateTo);
        }
      }

      if (dateConditions.length > 0) {
        dateFilterPerms = 'WHERE ' + dateConditions.join(' AND ');
      }
    }
    if (status && status !== 'Todos') {
      const statusMap: { [key: string]: string } = {
        'Pendiente': 'pending',
        'Aprobado': 'approved',
        'Rechazado': 'rejected'
      };
      const dbStatus = statusMap[status] || status;
      wherePerms.push('p.solicitud = ?');
      paramsPerms.push(dbStatus);
    }
    if (type && type !== 'Todos') {
      wherePerms.push('p.tipo_novedad = ?');
      paramsPerms.push(type);
    }
    if (!canReadAllRequests && shouldFilterByUserCode) {
      wherePerms.push('p.code = ?');
      paramsPerms.push(currentUser.code);
      console.log('DEBUG BACKEND: Aplicando filtro por código de usuario:', currentUser.code);
    } else if (userType && userType === 'se_maintenance') {
      console.log('DEBUG BACKEND: Aplicando filtro userType=se_maintenance');
      wherePerms.push('p.userType = ?');
      paramsPerms.push('se_maintenance');
    } else if (userType && userType === 'se_operaciones') {
      // Para se_operaciones: mostrar solo registros que NO sean se_maintenance
      console.log('DEBUG BACKEND: Aplicando filtro para se_operaciones - excluyendo se_maintenance');
      wherePerms.push('(p.userType IS NULL OR p.userType IN (?, ?, ?))');
      paramsPerms.push('se_operaciones', 'employee', 'registered');
    } else {
      console.log('DEBUG BACKEND: No se aplica filtro userType, valor recibido:', userType);
    }
    // permit_post
    let wherePost: string[] = [];
    let paramsPost: any[] = [];
    let dateFilterPost = '';
    if (dateFrom || dateTo) {
      let dateConditions: string[] = [];

      // Si ambas fechas son iguales, buscar registros de ese día específico
      if (dateFrom && dateTo && dateFrom === dateTo) {
        dateConditions.push(`DATE(p.time_created) = ?`);
        paramsPost.push(dateFrom);
      } else {
        // Lógica para rango de fechas
        if (dateFrom) {
          dateConditions.push(`DATE(p.time_created) >= ?`);
          paramsPost.push(dateFrom);
        }
        if (dateTo) {
          dateConditions.push(`DATE(p.time_created) <= ?`);
          paramsPost.push(dateTo);
        }
      }

      if (dateConditions.length > 0) {
        dateFilterPost = 'WHERE ' + dateConditions.join(' AND ');
      }
    }
    if (status && status !== 'Todos') {
      const statusMap: { [key: string]: string } = {
        'Pendiente': 'pending',
        'Aprobado': 'approved',
        'Rechazado': 'rejected'
      };
      const dbStatus = statusMap[status] || status;
      wherePost.push('p.solicitud = ?');
      paramsPost.push(dbStatus);
    }
    if (type && type !== 'Todos') {
      wherePost.push('p.tipo_novedad = ?');
      paramsPost.push(type);
    }
    // CRITICAL FIX: Apply user code filter to permit_post table too
    if (!canReadAllRequests && shouldFilterByUserCode) {
      wherePost.push('p.code = ?');
      paramsPost.push(currentUser.code);
      console.log('DEBUG BACKEND: Aplicando filtro por código de usuario en permit_post:', currentUser.code);
    }
    // Note: permit_post doesn't have userType column, so no filtering needed for se_maintenance
    // Only permit_perms has userType column for maintenance employees

    // --- FIN NUEVO ---

    const source = c.req.query('source'); // 'all', 'permisos', 'postulaciones'

    // Logic to select query parts based on source
    const includePerms = !source || source === 'all' || source === 'permisos';
    // Se_maintenance users should NOT see permit_post table at all (it doesn't have userType column)
    const includePost = (userType !== 'se_maintenance') && (!source || source === 'all' || source === 'postulaciones');

    // Construcción de la consulta UNION
    let parts: string[] = [];
    let queryParams: any[] = [];

    // Parte Permisos
    if (includePerms) {
      if (shouldFilterByUserCode || userType === 'se_maintenance') {
        parts.push(`(SELECT p.id, p.code, p.name, p.telefono as phone, p.fecha as dates, p.hora as time,
                p.tipo_novedad as type, p.tipo_novedad as noveltyType, p.description,
                p.files, p.time_created as createdAt, p.solicitud as status,
                p.respuesta as reason, p.notifications, 'permiso' as request_type,
                NULL as zona, NULL as codeAM, NULL as codePM, NULL as shift,
                u.password, 
                COALESCE(p.userType, 'registered') as userType,
                CASE 
                  WHEN COALESCE(p.userType, 'registered') = 'se_maintenance' THEN 'Personal de Mantenimiento'
                  ELSE 'Usuario Registrado'
                END as tipo_usuario_desc
         FROM permit_perms p
         LEFT JOIN users u ON p.code = u.code
         ${dateFilterPerms}
         ${wherePerms.length > 0 ? (dateFilterPerms ? ' AND ' : ' WHERE ') + wherePerms.join(' AND ') : ''})`);
      } else {
        parts.push(`(SELECT p.id, p.code, p.name, p.telefono as phone, p.fecha as dates, p.hora as time,
                p.tipo_novedad as type, p.tipo_novedad as noveltyType, p.description,
                p.files, p.time_created as createdAt, p.solicitud as status,
                p.respuesta as reason, p.notifications, 'permiso' as request_type,
                NULL as zona, NULL as codeAM, NULL as codePM, NULL as shift,
                u.password, 
                COALESCE(p.userType, 'registered') as userType,
                CASE 
                  WHEN COALESCE(p.userType, 'registered') = 'se_maintenance' THEN 'Personal de Mantenimiento'
                  ELSE 'Usuario Registrado'
                END as tipo_usuario_desc
         FROM permit_perms p
         LEFT JOIN users u ON p.code = u.code
         ${dateFilterPerms}
         ${wherePerms.length > 0 ? (dateFilterPerms ? ' AND ' : ' WHERE ') + wherePerms.join(' AND ') : ''})`);
      }
      queryParams.push(...paramsPerms);
    }

    // Parte Postulaciones
    if (includePost) {
      // Logic for columns matches original
      parts.push(`(SELECT p.id, p.code, p.name, NULL as phone, NULL as dates, NULL as time,
                p.tipo_novedad as type, p.tipo_novedad as noveltyType, p.description,
                NULL as files, p.time_created as createdAt, p.solicitud as status, 
                p.respuesta as reason, p.notifications, 'postulaciones' as request_type,
                p.zona, p.comp_am as codeAM, p.comp_pm as codePM, p.turno as shift,
                u.password, 'registered' as userType, 'Usuario Registrado' as tipo_usuario_desc
         FROM permit_post p
         LEFT JOIN users u ON p.code = u.code
         ${dateFilterPost}
         ${wherePost.length > 0 ? (dateFilterPost ? ' AND ' : ' WHERE ') + wherePost.join(' AND ') : ''})`);
      queryParams.push(...paramsPost);
    }

    let unionQuery = parts.join(' UNION ALL ') + ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';

    // Fallback if no parts selected (shouldn't happen with default logic)
    if (parts.length === 0) unionQuery = "SELECT NULL LIMIT 0";

    // Construcción de Total Count
    let countParts: string[] = [];
    let countParams: any[] = [];

    if (includePerms) {
      countParts.push(`(SELECT p.id FROM permit_perms p LEFT JOIN users u ON p.code = u.code ${dateFilterPerms} ${wherePerms.length > 0 ? (dateFilterPerms ? ' AND ' : ' WHERE ') + wherePerms.join(' AND ') : ''})`);
      countParams.push(...paramsPerms);
    }
    if (includePost) {
      countParts.push(`(SELECT p.id FROM permit_post p LEFT JOIN users u ON p.code = u.code ${dateFilterPost} ${wherePost.length > 0 ? (dateFilterPost ? ' AND ' : ' WHERE ') + wherePost.join(' AND ') : ''})`);
      countParams.push(...paramsPost);
    }

    let totalCountQuery = `SELECT COUNT(*) as total FROM (${countParts.join(' UNION ALL ')}) as total_table`;

    // Construcción de Stats
    let statsParts: string[] = [];
    let statsParams: any[] = [];

    if (includePerms) {
      statsParts.push(`(SELECT p.solicitud FROM permit_perms p LEFT JOIN users u ON p.code = u.code ${dateFilterPerms} ${wherePerms.length > 0 ? (dateFilterPerms ? ' AND ' : ' WHERE ') + wherePerms.join(' AND ') : ''})`);
      statsParams.push(...paramsPerms);
    }
    if (includePost) {
      statsParts.push(`(SELECT p.solicitud FROM permit_post p LEFT JOIN users u ON p.code = u.code ${dateFilterPost} ${wherePost.length > 0 ? (dateFilterPost ? ' AND ' : ' WHERE ') + wherePost.join(' AND ') : ''})`);
      statsParams.push(...paramsPost);
    }

    let statsQuery = `SELECT solicitud as status, COUNT(*) as count FROM (${statsParts.join(' UNION ALL ')}) as all_requests GROUP BY solicitud`;

    // Agregar parámetros de paginación al final
    const finalQueryParams = limit === -1 ? [...queryParams] : [...queryParams, limit, offset];
    const totalCountParams = [...countParams];

    if (limit === -1) {
      unionQuery = unionQuery.replace('LIMIT ? OFFSET ?', '');
    }

    const [allRequestsRaw, totalResult, statsResult] = await Promise.all([
      executeQuery<any[]>(unionQuery, finalQueryParams, { fetchAll: true }),
      executeQuery<{ total: number }>(totalCountQuery, totalCountParams, { fetchOne: true }),
      executeQuery<{ status: string; count: number }[]>(statsQuery, statsParams, { fetchAll: true })
    ]);

    // --- FILTRADO PROFESIONAL DE FECHAS EN BACKEND ---
    let allRequests = allRequestsRaw || [];
    const dateFromQ = c.req.query('dateFrom');
    const dateToQ = c.req.query('dateTo');
    let filteredByDate = false;
    if (dateFromQ && dateToQ) {
      // Solo dejar los registros que tengan al menos una fecha en el rango [dateFrom, dateTo)
      const isDateInRange = (dateStr: string, from: string, to: string) => {
        // dateStr: '2025-07-21', from/to: 'YYYY-MM-DD'
        return dateStr >= from && dateStr < to;
      };
      const recordHasDateInRange = (record: any, from: string, to: string) => {
        if (!record.dates) return false;
        const datesArr = Array.isArray(record.dates)
          ? record.dates
          : String(record.dates).split(',').map((d: string) => d.trim());
        return datesArr.some((date: string) => isDateInRange(date, from, to));
      };
      allRequests = allRequests.filter((r: any) => recordHasDateInRange(r, dateFromQ, dateToQ));
      filteredByDate = true;
    }
    // --- FIN FILTRADO PROFESIONAL DE FECHAS ---

    // Procesar los datos para asegurar consistencia
    for (const request of allRequests || []) {
      for (const key in request) if (request[key] === null) request[key] = '';
      if (request.dates && typeof request.dates === 'string') {
        request.dates = request.dates.split(',').map((d: string) => d.trim());
      }
      if (request.files && typeof request.files === 'string') {
        request.files = request.files.split(',').map((f: string) => f.trim());
      }
      if (!['pending', 'approved', 'rejected'].includes(request.status)) {
        request.status = 'pending';
      }
    }

    // Si se filtró por fecha, ajustar total, paginación y stats
    let total = filteredByDate ? allRequests.length : (totalResult?.total || 0);
    let pageRequests = allRequests;
    if (filteredByDate && limit !== -1) {
      const page = parseInt(c.req.query('page') || '1', 10);
      const offset = (page - 1) * limit;
      pageRequests = allRequests.slice(offset, offset + limit);
    }

    // Calcular estadísticas solo de los registros filtrados
    let stats = { total, pending: 0, approved: 0, rejected: 0 };
    if (filteredByDate) {
      for (const r of allRequests as any[]) {
        const status = (r.status || '').toLowerCase();
        if (status.includes('pendiente') || status.includes('pending')) stats.pending++;
        else if (status.includes('aprobado') || status.includes('approved')) stats.approved++;
        else if (status.includes('rechazado') || status.includes('rejected')) stats.rejected++;
        else stats.pending++;
      }
    } else if (statsResult) {
      for (const stat of statsResult) {
        const status = stat.status?.toLowerCase() || 'pending';
        if (status.includes('pendiente') || status.includes('pending')) {
          stats.pending += stat.count;
        } else if (status.includes('aprobado') || status.includes('approved')) {
          stats.approved += stat.count;
        } else if (status.includes('rechazado') || status.includes('rejected')) {
          stats.rejected += stat.count;
        } else {
          stats.pending += stat.count; // Default to pending for unknown statuses
        }
      }
    }

    logger.info({
      requestsCount: allRequests?.length || 0,
      total: totalResult?.total || 0
    }, 'Solicitudes obtenidas exitosamente');

    return c.json({
      data: pageRequests || [],
      page: parseInt(c.req.query('page') || '1', 10),
      limit,
      total,
      totalPages: Math.ceil(total / (limit === -1 ? total || 1 : limit)),
      stats
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      page: c.req.query('page'),
      limit: c.req.query('limit')
    }, 'Error al obtener solicitudes');

    throw new HTTPException(500, {
      message: 'Error interno del servidor al obtener las solicitudes'
    });
  }
});

// GET /filter-options - Obtener opciones para filtros
admin.get('/filter-options', requirePermission('requests:read'), async (c) => {
  try {
    logger.info('Obteniendo opciones de filtros');

    // Consulta para obtener todos los tipos únicos
    const typesQuery = `
      SELECT DISTINCT tipo_novedad as type
      FROM (
        (SELECT tipo_novedad FROM permit_perms WHERE tipo_novedad IS NOT NULL AND tipo_novedad != '')
        UNION
        (SELECT tipo_novedad FROM permit_post WHERE tipo_novedad IS NOT NULL AND tipo_novedad != '')
      ) as all_types
      ORDER BY type
    `;

    // Consulta para obtener todos los departamentos únicos (si existe el campo)
    const departmentsQuery = `
      SELECT DISTINCT 'General' as department
    `;

    const [typesResult, departmentsResult] = await Promise.all([
      executeQuery<{ type: string }[]>(typesQuery, [], { fetchAll: true }),
      executeQuery<{ department: string }[]>(departmentsQuery, [], { fetchAll: true })
    ]);

    const types = typesResult?.map((row: { type: string }) => row.type).filter(Boolean) || [];
    const departments = departmentsResult?.map((row: { department: string }) => row.department).filter(Boolean) || ['General'];

    return c.json({
      types,
      departments,
      statuses: ['Pendiente', 'Aprobado', 'Rechazado'],
      priorities: ['Urgente', 'Alta', 'Media', 'Baja']
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 'Error al obtener opciones de filtros');

    throw new HTTPException(500, {
      message: 'Error interno del servidor al obtener opciones de filtros'
    });
  }
});

// GET /requests/{code} - Obtener solicitudes por código de usuario
admin.get('/requests/:code', requireAnyPermission(['requests:read', 'requests:read_own']), async (c) => {
  const code = c.req.param('code');
  if (!code) throw new HTTPException(400, { message: 'Código de usuario requerido' });

  const permitRequests = await executeQuery<any[]>(
    `SELECT
        p.id,
        p.code,
        p.name,
        p.telefono as phone,
        p.fecha as dates,
        p.hora as time,
        p.tipo_novedad as type,
        p.tipo_novedad as noveltyType,
        p.description,
        p.files,
        p.time_created as createdAt,
        p.solicitud as status,
        p.respuesta as reason,
        p.notifications,
        u.password
      FROM permit_perms p
      LEFT JOIN users u ON p.code = u.code
      WHERE p.code = ? AND p.notifications = '0'`,
    [code], { fetchAll: true }
  );
  const equipmentRequests = await executeQuery<any[]>(
    `SELECT
        p.id,
        p.code,
        p.name,
        p.tipo_novedad as type,
        p.tipo_novedad as noveltyType,
        p.description,
        p.time_created as createdAt,
        p.solicitud as status,
        p.respuesta as reason,
        p.notifications,
        p.zona,
        p.comp_am as codeAM,
        p.comp_pm as codePM,
        p.turno as shift,
        'postulaciones' as request_type,
        u.password
      FROM permit_post p
      LEFT JOIN users u ON p.code = u.code
      WHERE p.code = ? AND p.notifications = '0'`,
    [code], { fetchAll: true }
  );

  const allRequests = [...(permitRequests || []), ...(equipmentRequests || [])];

  for (const request of allRequests) {
    for (const key in request) if (request[key] === null) request[key] = '';
    if (request.dates && typeof request.dates === 'string') {
      request.dates = request.dates.split(',').map((d: string) => d.trim());
    }
    if (request.files && typeof request.files === 'string') {
      request.files = request.files.split(',').map((f: string) => f.trim());
    }
    if (!['pending', 'approved', 'rejected'].includes(request.status)) {
      request.status = 'pending';
    }
  }
  return c.json(allRequests);
});

// PUT /requests/{id} - Actualizar solicitud
admin.put('/requests/:id', requirePermission('requests:approve'), async (c) => {
  const id = parseInt(c.req.param('id') || '0', 10);
  const body = await c.req.json();
  const request: RequestUpdateInput = validateWithZod(RequestUpdateSchema, body);
  if (!id) throw new HTTPException(400, { message: 'ID de solicitud requerido' });

  const result1 = await executeQuery(
    'UPDATE permit_perms SET solicitud = ?, respuesta = ? WHERE id = ?',
    [request.status, request.respuesta || '', id], { commit: true }
  );
  if ((result1 as any).affectedRows === 0) {
    const result2 = await executeQuery(
      'UPDATE permit_post SET solicitud = ?, respuesta = ? WHERE id = ?',
      [request.status, request.respuesta || '', id], { commit: true }
    );
    if ((result2 as any).affectedRows === 0) {
      throw new HTTPException(404, { message: 'Solicitud no encontrada' });
    }
  }
  logger.info({ requestId: id, status: request.status }, 'Solicitud actualizada');
  return c.json({ message: 'Solicitud actualizada exitosamente' });
});

// PUT /requests/{id}/notifications - Actualizar estado de notificación
admin.put('/requests/:id/notifications', requirePermission('notifications:write'), async (c) => {
  const id = parseInt(c.req.param('id') || '0', 10);
  const body = await c.req.json();
  const payload: NotificationStatusUpdateInput = validateWithZod(NotificationStatusUpdateSchema, body);
  if (!id) throw new HTTPException(400, { message: 'ID de solicitud requerido' });

  const result1 = await executeQuery(
    'UPDATE permit_perms SET notifications = ? WHERE id = ?',
    [payload.notification_status, id], { commit: true }
  );
  if ((result1 as any).affectedRows === 0) {
    const result2 = await executeQuery(
      'UPDATE permit_post SET notifications = ? WHERE id = ?',
      [payload.notification_status, id], { commit: true }
    );
    if ((result2 as any).affectedRows === 0) {
      throw new HTTPException(404, { message: 'Solicitud no encontrada' });
    }
  }
  logger.info({ requestId: id, notificationStatus: payload.notification_status }, 'Estado de notificación actualizado');
  return c.json({ message: 'Estado de notificación actualizado exitosamente' });
});

// PUT /update-approval/{id} - Actualizar aprobación
admin.put('/update-approval/:id', requirePermission('requests:approve'), async (c) => {
  const id = parseInt(c.req.param('id') || '0', 10);
  const body = await c.req.json();
  const approval: ApprovalUpdateInput = validateWithZod(ApprovalUpdateSchema, body);
  if (!id) throw new HTTPException(400, { message: 'ID de solicitud requerido' });

  const result = await executeQuery(
    'UPDATE permit_perms SET Aprobado = ? WHERE id = ?',
    [approval.approved_by, id], { commit: true }
  );
  if ((result as any).affectedRows === 0) {
    throw new HTTPException(404, { message: 'Solicitud no encontrada' });
  }
  logger.info({ requestId: id, approvedBy: approval.approved_by }, 'Aprobación actualizada');
  return c.json({ message: 'Aprobación actualizada exitosamente' });
});

// DELETE /requests/{id} - Eliminar solicitud
admin.delete('/requests/:id', requirePermission('requests:delete'), async (c) => {
  const id = parseInt(c.req.param('id') || '0', 10);
  if (!id) throw new HTTPException(400, { message: 'ID de solicitud requerido' });

  const result1 = await executeQuery('DELETE FROM permit_perms WHERE id = ?', [id], { commit: true });
  if ((result1 as any).affectedRows === 0) {
    const result2 = await executeQuery('DELETE FROM permit_post WHERE id = ?', [id], { commit: true });
    if ((result2 as any).affectedRows === 0) {
      throw new HTTPException(404, { message: 'Solicitud no encontrada' });
    }
  }
  logger.info({ requestId: id }, 'Solicitud eliminada');
  return c.json({ message: 'Solicitud eliminada exitosamente' });
});

// GET /solicitudes - Obtener solicitudes del usuario actual
admin.get('/solicitudes', requireAnyPermission(['requests:read', 'requests:read_own']), async (c) => {
  const currentUser = c.get('currentUser') as User;

  const permitRequests = await executeQuery<any[]>(
    `SELECT
        id,
        code,
        name,
        telefono,
        fecha,
        hora,
        tipo_novedad,
        description,
        files,
        time_created as createdAt,
        solicitud as status,
        respuesta,
        notifications,
        file_name,
        file_url,
        '' as zona,
        '' as comp_am,
        '' as comp_pm,
        '' as turno,
        'permiso' as request_type
      FROM permit_perms
      WHERE code = ? AND solicitud IN ('approved', 'rejected', 'pending')`,
    [currentUser.code], { fetchAll: true }
  );
  const equipmentRequests = await executeQuery<any[]>(
    `SELECT
        id,
        code,
        name,
        tipo_novedad,
        description,
        time_created as createdAt,
        solicitud as status,
        respuesta,
        notifications,
        zona,
        comp_am,
        comp_pm,
        turno,
        '' as telefono,
        '' as fecha,
        '' as hora,
        '' as files,
        '' as file_name,
        '' as file_url,
        'postulaciones' as request_type
      FROM permit_post
      WHERE code = ? AND solicitud IN ('approved', 'rejected', 'pending')`,
    [currentUser.code], { fetchAll: true }
  );

  const allRequests = [...(permitRequests || []), ...(equipmentRequests || [])];

  for (const request of allRequests) {
    if (request.createdAt instanceof Date) {
      request.createdAt = request.createdAt.toISOString();
    }
    if (request.files && typeof request.files === 'string') {
      try {
        request.files = request.files.split(',').map((f: string) => f.trim());
      } catch {
        request.files = [request.files];
      }
    }
    for (const key in request) if (request[key] === null) request[key] = '';
  }
  return c.json(allRequests);
});

// GET /history/{code} - Obtener historial de usuario
admin.get('/history/:code', async (c) => {
  const code = c.req.param('code');
  if (!code) throw new HTTPException(400, { message: 'Código de usuario requerido' });

  const userExists = await executeQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE code = ?', [code], { fetchOne: true }
  );
  if (!userExists || userExists.count === 0) {
    throw new HTTPException(404, { message: `No se encontró un usuario con el código ${code}` });
  }

  const history = await executeQuery<HistoryRecord[]>(
    `SELECT
        id,
        COALESCE(tipo_novedad, 'Sin tipo') AS type,
        COALESCE(time_created, NOW()) AS createdAt,
        COALESCE(fecha, '') AS requestedDates,
        COALESCE(solicitud, 'Pendiente') AS status
      FROM permit_perms
      WHERE code = ?
      ORDER BY time_created DESC
      LIMIT 50`,
    [code], { fetchAll: true }
  );

  for (const item of history || []) {
    if (item.createdAt) {
      if (typeof item.createdAt === 'string') {
        try {
          item.createdAt = new Date(item.createdAt).toISOString();
        } catch {
          item.createdAt = new Date().toISOString();
        }
      } else if (item.createdAt instanceof Date) {
        item.createdAt = item.createdAt.toISOString();
      }
    }
  }
  return c.json(history || []);
});

// GET /requests/{id}/history - Obtener historial de una solicitud específica
admin.get('/requests/:id/history', getCurrentUser, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0', 10);

    if (!id) {
      throw new HTTPException(400, { message: 'ID de solicitud requerido' });
    }

    logger.info({ requestId: id }, 'Obteniendo historial de solicitud');

    // Buscar en ambas tablas para encontrar la solicitud
    const permitRequest = await executeQuery<any>(
      `SELECT 
        id,
        code,
        name,
        tipo_novedad as type,
        time_created as createdAt,
        solicitud as status,
        fecha as requestedDates,
        respuesta as reason,
        'permiso' as request_type
      FROM permit_perms 
      WHERE id = ?`,
      [id],
      { fetchOne: true }
    );

    const equipmentRequest = await executeQuery<any>(
      `SELECT 
        id,
        code,
        name,
        tipo_novedad as type,
        time_created as createdAt,
        solicitud as status,
        zona as requestedDates,
        respuesta as reason,
        'equipo' as request_type
      FROM permit_post 
      WHERE id = ?`,
      [id],
      { fetchOne: true }
    );

    const request = permitRequest || equipmentRequest;

    if (!request) {
      throw new HTTPException(404, { message: 'Solicitud no encontrada' });
    }

    // Crear historial basado en la solicitud encontrada
    const history = [
      {
        id: `hist_${request.id}_1`,
        type: 'Solicitud creada',
        createdAt: request.createdAt,
        status: 'created',
        description: `Solicitud de ${request.request_type} creada por ${request.name}`
      }
    ];

    // Agregar entrada de cambio de estado si no está pendiente
    if (request.status !== 'pending') {
      history.push({
        id: `hist_${request.id}_2`,
        type: `Solicitud ${request.status === 'approved' ? 'aprobada' : 'rechazada'}`,
        createdAt: request.createdAt, // Usar la misma fecha por ahora
        status: request.status,
        description: request.reason || `Solicitud ${request.status === 'approved' ? 'aprobada' : 'rechazada'}`
      });
    }

    // Agregar entrada de notificación si existe
    if (request.notifications === '1') {
      history.push({
        id: `hist_${request.id}_3`,
        type: 'Notificación enviada',
        createdAt: request.createdAt,
        status: 'notified',
        description: 'Notificación enviada al solicitante'
      });
    }

    logger.info({
      requestId: id,
      historyCount: history.length
    }, 'Historial de solicitud obtenido exitosamente');

    return c.json({
      history: history,
      request: {
        id: request.id,
        type: request.type,
        status: request.status,
        requestedDates: request.requestedDates,
        createdAt: request.createdAt
      }
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: c.req.param('id')
    }, 'Error al obtener historial de solicitud');

    throw new HTTPException(500, {
      message: 'Error interno del servidor al obtener el historial'
    });
  }
});

// GET /requests/user/{code}/history - Obtener historial completo de solicitudes de una persona
admin.get('/requests/user/:code/history', getCurrentUser, requireAdmin, async (c) => {
  try {
    const userCode = c.req.param('code');

    if (!userCode) {
      throw new HTTPException(400, { message: 'Código de usuario requerido' });
    }

    logger.info({ userCode }, 'Obteniendo historial completo de usuario');

    // Obtener todas las solicitudes de permisos del usuario
    const permitRequests = await executeQuery<any[]>(
      `SELECT 
        id,
        code,
        name,
        tipo_novedad as type,
        time_created as createdAt,
        solicitud as status,
        fecha as requestedDates,
        respuesta as reason,
        description,
        'permiso' as request_type
      FROM permit_perms 
      WHERE code = ?
      ORDER BY time_created DESC`,
      [userCode],
      { fetchAll: true }
    );

    // Obtener todas las solicitudes de equipos del usuario
    const equipmentRequests = await executeQuery<any[]>(
      `SELECT 
        id,
        code,
        name,
        tipo_novedad as type,
        time_created as createdAt,
        solicitud as status,
        zona as requestedDates,
        respuesta as reason,
        description,
        'postulaciones' as request_type
      FROM permit_post 
      WHERE code = ?
      ORDER BY time_created DESC`,
      [userCode],
      { fetchAll: true }
    );

    // Combinar y ordenar todas las solicitudes
    const allRequests = [...(permitRequests || []), ...(equipmentRequests || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Crear historial detallado
    const history = allRequests.map((request, index) => {
      const baseHistory = [
        {
          id: `hist_${request.id}_created`,
          type: `Solicitud de ${request.request_type}`,
          createdAt: request.createdAt,
          status: request.status, // Usar el estado real de la base de datos
          description: `${request.type} - ${request.description || 'Sin descripción'}`,
          requestedDates: request.requestedDates,
          requestId: request.id,
          requestType: request.request_type
        }
      ];

      // Agregar entrada de respuesta si no está pendiente
      if (request.status !== 'pending' && request.reason) {
        baseHistory.push({
          id: `hist_${request.id}_${request.status}`,
          type: `Solicitud ${request.status === 'approved' ? 'aprobada' : 'rechazada'}`,
          createdAt: request.createdAt,
          status: request.status,
          description: request.reason,
          requestedDates: request.requestedDates,
          requestId: request.id,
          requestType: request.request_type
        });
      }

      return baseHistory;
    }).flat();

    logger.info({
      userCode,
      totalRequests: allRequests.length,
      historyCount: history.length
    }, 'Historial completo de usuario obtenido exitosamente');

    return c.json({
      history: history,
      userInfo: {
        code: userCode,
        name: allRequests[0]?.name || 'Usuario',
        totalRequests: allRequests.length,
        totalPermits: permitRequests?.length || 0,
        totalEquipment: equipmentRequests?.length || 0
      },
      requests: allRequests
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userCode: c.req.param('code')
    }, 'Error al obtener historial completo de usuario');

    throw new HTTPException(500, {
      message: 'Error interno del servidor al obtener el historial completo'
    });
  }
});

// GET /test-db - Ruta de prueba para verificar la base de datos
admin.get('/test-db', async (c) => {
  try {
    // Verificar que las tablas existen
    const tablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('permit_perms', 'permit_post', 'users')
    `;

    const tables = await executeQuery<any[]>(
      tablesQuery,
      [process.env.DB_NAME || 'bdsaocomco_solicitudpermisos'],
      { fetchAll: true }
    );

    logger.info({ tables: tables?.map((t: any) => t.TABLE_NAME) }, 'Tablas encontradas');

    // Verificar estructura de las tablas
    const permitPermsStructure = await executeQuery<any[]>(
      'DESCRIBE permit_perms',
      [],
      { fetchAll: true }
    );

    const permitPostStructure = await executeQuery<any[]>(
      'DESCRIBE permit_post',
      [],
      { fetchAll: true }
    );

    return c.json({
      message: 'Conexión a la base de datos exitosa',
      tables: tables?.map((t: any) => t.TABLE_NAME) || [],
      permitPermsColumns: permitPermsStructure?.map((c: any) => c.Field) || [],
      permitPostColumns: permitPostStructure?.map((c: any) => c.Field) || []
    });

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 'Error en prueba de base de datos');

    throw new HTTPException(500, {
      message: 'Error al conectar con la base de datos'
    });
  }
});

// POST /create-user - Crear nuevo usuario en MySQL
admin.post('/create-user', getCurrentUser, requireAdmin, async (c) => {
  try {
    const { name, code, cedula, telefone, cargo } = await c.req.json();

    // Validaciones
    if (!name || !code || !cedula) {
      return c.json({
        success: false,
        error: 'Faltan campos requeridos: name, code, cedula'
      }, 400);
    }

    // Validar que el código sea de 4 dígitos
    if (!/^\d{4}$/.test(code)) {
      return c.json({
        success: false,
        error: 'El código debe ser de exactamente 4 dígitos'
      }, 400);
    }

    logger.info({ name, code, cedula, cargo }, 'Creando nuevo usuario');

    const connection = await getConnection();

    try {
      // Verificar si ya existe un usuario con la misma cédula (password) o código
      const [existingUsers] = await connection.execute(
        'SELECT id, code, password FROM users WHERE password = ? OR code = ?',
        [cedula, code]
      ) as [any[], any];

      if (existingUsers.length > 0) {
        const duplicateField = existingUsers[0].password === cedula ? 'cédula' : 'código';
        return c.json({
          success: false,
          error: `Ya existe un usuario con esta ${duplicateField}`
        }, 409);
      }

      // Crear el nuevo usuario
      // password = cedula, code = código de 4 dígitos, role = 'employee' por defecto
      const [result] = await connection.execute(
        `INSERT INTO users (name, code, password, telefone, cargo, role, userType) 
         VALUES (?, ?, ?, ?, ?, 'employee', 'employee')`,
        [name, code, cedula, telefone || null, cargo || null]
      ) as [any, any];

      logger.info({ userId: result.insertId, name, code, cedula }, 'Usuario creado exitosamente');

      return c.json({
        success: true,
        message: 'Usuario creado exitosamente',
        userId: result.insertId
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error({ error }, 'Error al crear usuario');
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return c.json({
      success: false,
      error: errorMessage
    }, 500);
  }
});

export default admin;