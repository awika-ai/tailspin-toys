import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategia', description: 'kat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Wydawca Jeden', description: 'wyd' })
        .returning({ id: publishers.id });

    // Wstawiamy tytuły w odwrotnej kolejności alfabetycznej, żeby sprawdzić sortowanie.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Gra ${String(i).padStart(2, '0')}`,
            description: `Opis ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Zasila bazę minimalnym zestawem gier do sprawdzania filtrów. */
async function seedFilterableGames(
    db: Database,
): Promise<{ strategyId: number; puzzlesId: number; publisherOneId: number; publisherTwoId: number }> {
    const [strategy, puzzles] = await db
        .insert(categories)
        .values([
            { name: 'Strategia', description: 'kat' },
            { name: 'Łamigłówki', description: 'kat' },
        ])
        .returning({ id: categories.id });
    const [publisherOne, publisherTwo] = await db
        .insert(publishers)
        .values([
            { name: 'Wydawca Jeden', description: 'wyd' },
            { name: 'Wydawca Dwa', description: 'wyd' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Gra Alfa',
            description: 'Opis',
            categoryId: strategy.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Gra Beta',
            description: 'Opis',
            categoryId: puzzles.id,
            publisherId: publisherOne.id,
        },
        {
            title: 'Gra Gamma',
            description: 'Opis',
            categoryId: strategy.id,
            publisherId: publisherTwo.id,
        },
    ]);

    return {
        strategyId: strategy.id,
        puzzlesId: puzzles.id,
        publisherOneId: publisherOne.id,
        publisherTwoId: publisherTwo.id,
    };
}

describe('helpery dostępu do danych o grach', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('zwraca wszystkie gry posortowane po tytule', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Gra 01', 'Gra 02', 'Gra 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategia' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Wydawca Jeden' });
    });

    it('zwraca identyfikatory wszystkich gier posortowane po tytule', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('pobiera pojedynczą grę po id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Gra 01');
    });

    it('zwraca null dla nieistniejącej gry', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filtruje gry po jednej lub wielu kategoriach', async () => {
        const { strategyId, puzzlesId } = await seedFilterableGames(db);

        const strategyGames = await getGamesByFilters(db, { categoryIds: [strategyId] });
        const selectedGames = await getGamesByFilters(db, { categoryIds: [strategyId, puzzlesId] });

        expect(strategyGames.map((game) => game.title)).toEqual(['Gra Alfa', 'Gra Gamma']);
        expect(selectedGames.map((game) => game.title)).toEqual(['Gra Alfa', 'Gra Beta', 'Gra Gamma']);
    });

    it('filtruje gry po wydawcy', async () => {
        const { publisherOneId } = await seedFilterableGames(db);

        const result = await getGamesByFilters(db, { publisherId: publisherOneId });

        expect(result.map((game) => game.title)).toEqual(['Gra Alfa', 'Gra Beta']);
    });

    it('łączy filtr kategorii z filtrem wydawcy', async () => {
        const { strategyId, publisherTwoId } = await seedFilterableGames(db);

        const result = await getGamesByFilters(db, {
            categoryIds: [strategyId],
            publisherId: publisherTwoId,
        });

        expect(result.map((item) => item.title)).toEqual(['Gra Gamma']);
    });

    it('zwraca pustą listę, gdy filtry nie mają dopasowań', async () => {
        await seedFilterableGames(db);

        expect(await getGamesByFilters(db, { publisherId: 99999 })).toEqual([]);
    });
});
