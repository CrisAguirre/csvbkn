const logger = require('../utils/logger');
const { ZodError } = require('zod');

/**
 * Middleware genérico para interceptar y validar payloads con Zod
 * @param {z.ZodSchema} schema 
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      // Mapeamos los errores de Zod a un formato más legible
      const formattedErrors = err.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      
      // Registramos la falla para auditoría
      logger.error(`Validation Error [${req.method}] ${req.originalUrl}: ` + JSON.stringify(formattedErrors));

      // Cortamos la petición devolviendo un HTTP 400 Bad Request
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos o mal formateados',
        errors: formattedErrors
      });
    }

    // Si es otro tipo de error
    logger.error(`Error inesperado en validación [${req.method}] ${req.originalUrl}: ` + err.message);
    return res.status(500).json({ success: false, message: 'Error interno de validación' });
  }
};

module.exports = validate;
