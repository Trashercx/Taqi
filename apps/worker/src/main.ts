import { logger } from './logger';
import { createRedisConnection } from './redis';

/**
 * Fase 0: el worker solo confirma conectividad con Redis y queda listo
 * como contenedor separado. Los procesadores BullMQ (alertas, agregados
 * de consumo, correos) se añaden a partir de la Fase 2 del roadmap.
 */
async function bootstrap() {
  const redis = createRedisConnection();

  redis.on('connect', () => logger.info('worker conectado a Redis'));
  redis.on('error', (error) => logger.error({ error }, 'error de conexion a Redis'));

  const shutdown = async () => {
    logger.info('apagando worker');
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('worker iniciado');
}

bootstrap();
