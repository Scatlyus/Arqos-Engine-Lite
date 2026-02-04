import { plan } from '../src/ae2-strategos';

test('entrada X gera plano determinístico no LITE', () => {
    const planOut = plan({ mode: 'lite', goal: 'sumarizar', tools: ['InsightSummarizer'] });
    expect(planOut).toMatchSnapshot();
});
