import request from 'supertest';
import { createServer } from '../src/server';
import { createValidator } from 'openapi-response-validator';
// Note: This import path assumes the file exists relative to this test file.
// Adjust as needed based on actual build output or localized copy.
import spec from '../../../openapi/maestro.v1.yaml';
// Since yaml import might need config, in a real setup we might readFileSync or use a loader.
// For this example file, we'll assume a way to load it or it's implicitly handled.

// quick mock for spec if not loadable in this context
// const spec = { paths: { '/metrics': { get: { responses: { '200': { schema: { type: 'object' } } } } } } };

const validate = new createValidator({ responses: (spec as any).paths['/metrics'].get.responses });

let app: any;
beforeAll(async () => { app = await createServer({ mode: 'fullstack' }); });

test('GET /metrics -> 200 e schema ok', async () => {
    const res = await request(app).get('/metrics').expect(200);
    // In real implementation, ensure spec is correctly typed/loaded
    const err = validate.validateResponse(200, res.body);
    expect(err).toBeUndefined();
    expect(res.body).toHaveProperty('latencyP90');
    expect(res.body).toHaveProperty('successRate');
});
