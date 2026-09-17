import { afterEach, describe, expect, it } from 'vitest';
import { createRedisConnection } from './redis';

describe('createRedisConnection', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('parses host and port from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://myhost:1234';
    const redis = createRedisConnection();

    expect(redis.options.host).toBe('myhost');
    expect(redis.options.port).toBe(1234);

    redis.disconnect();
  });

  it('falls back to localhost:6379 when REDIS_URL is unset', () => {
    delete process.env.REDIS_URL;
    const redis = createRedisConnection();

    expect(redis.options.host).toBe('localhost');
    expect(redis.options.port).toBe(6379);

    redis.disconnect();
  });
});
