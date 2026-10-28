import { test, expect } from '@playwright/test';

test.describe('Filtrowanie gier', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('filtruje gry po wielu wybranych kategoriach', async ({ page }) => {
    const categories = page.getByRole('checkbox');
    const firstCategory = categories.nth(0);
    const secondCategory = categories.nth(1);
    const firstCategoryId = await firstCategory.getAttribute('value');
    const secondCategoryId = await secondCategory.getAttribute('value');
    const expectedCount =
      (await page.locator(`[data-game-category-id="${firstCategoryId}"]`).count()) +
      (await page.locator(`[data-game-category-id="${secondCategoryId}"]`).count());

    await test.step('Wybierz dwie kategorie i zastosuj filtry', async () => {
      await firstCategory.check();
      await secondCategory.check();
      await page.getByRole('button', { name: 'Zastosuj filtry' }).click();
    });

    await test.step('Pokaż gry należące do którejkolwiek z wybranych kategorii', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedCount);
      await expect(page).toHaveURL(/[?&]category=/);
    });
  });

  test('filtruje gry po wybranym wydawcy', async ({ page }) => {
    const publisher = page.getByLabel('Wydawca');
    await publisher.selectOption({ index: 1 });
    const publisherId = await publisher.inputValue();
    const expectedCount = await page.locator(`[data-game-publisher-id="${publisherId}"]`).count();

    await page.getByRole('button', { name: 'Zastosuj filtry' }).click();

    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedCount);
    await expect(page).toHaveURL(new RegExp(`[?&]publisher=${publisherId}`));
  });

  test('łączy filtr kategorii z filtrem wydawcy', async ({ page }) => {
    const firstCard = page.getByTestId('game-card').first();
    const categoryId = await firstCard.getAttribute('data-game-category-id');
    const publisherId = await firstCard.getAttribute('data-game-publisher-id');
    const expectedCount = await page.locator(
      `[data-game-category-id="${categoryId}"][data-game-publisher-id="${publisherId}"]`,
    ).count();

    await page.locator(`input[name="category"][value="${categoryId}"]`).check();
    await page.getByLabel('Wydawca').selectOption(publisherId ?? '');
    await page.getByRole('button', { name: 'Zastosuj filtry' }).click();

    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(expectedCount);
    await expect(page.getByTestId('filter-empty-state')).toBeHidden();
  });

  test('czyści filtry i ponownie pokazuje wszystkie gry', async ({ page }) => {
    await page.getByRole('checkbox').first().check();
    await page.getByLabel('Wydawca').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Zastosuj filtry' }).click();
    await page.getByRole('button', { name: 'Wyczyść filtry' }).click();

    await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(
      await page.getByTestId('game-card').count(),
    );
    await expect(page).toHaveURL('/');
  });
});
