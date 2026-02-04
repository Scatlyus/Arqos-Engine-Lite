import { test, expect } from '@playwright/test';

test('Dashboard mostra P90 e SuccessRate', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.getByText(/P90 Latency/i)).toBeVisible();
    await expect(page.getByText(/Success Rate/i)).toBeVisible();
});

test('Inspector de Memória lista nós vetoriais', async ({ page }) => {
    await page.goto('http://localhost:5173/memory');
    await expect(page.getByRole('table')).toBeVisible();
});
