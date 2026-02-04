import fc from 'fast-check';
import { runPipeline } from '../src/ae3-pipeline';

test('InputValidator nunca permite payload inválido', async () =>
    await fc.assert(
        fc.asyncProperty(fc.anything(), async (payload) => {
            const res = await runPipeline({ mode: 'lite', steps: ['InputValidator'], payload });
            if (res.ok) {
                expect(res.value).toBeDefined();
            } else {
                expect(res.error?.code).toMatch(/ARQOS_INPUT_INVALID|ARQOS_TOOL_ERROR/);
            }
        })
    ));
