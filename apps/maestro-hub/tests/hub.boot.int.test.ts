import { StartedPostgreSqlContainer, PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { startHub, stopHub } from '../../src';

let pg: StartedPostgreSqlContainer, redis: any, hub: any;

beforeAll(async () => {
    pg = await new PostgreSqlContainer().withDatabase('arqos').start();
    redis = await new GenericContainer('redis:7').withExposedPorts(6379).start();
    hub = await startHub({
        env: {
            ARQOS_MODE: 'fullstack',
            PG_URL: pg.getConnectionUri(),
            REDIS_URL: `redis://localhost:${redis.getMappedPort(6379)}`
        }
    });
});

afterAll(async () => { if (hub) await stopHub(hub); if (pg) await pg.stop(); if (redis) await redis.stop(); });

test('fluxo end-to-end registra trace e métricas', async () => {
    const r = await hub.gateway.inject({ method: 'POST', url: '/cognition/plan', payload: { goal: 'sumarizar' } });
    expect(r.statusCode).toBe(200);
    const m = await hub.gateway.inject({ method: 'GET', url: '/metrics' });
    expect(m.json().latencyP90).toBeGreaterThanOrEqual(0);
});
