import { paginateAll, paginateAllData } from '../firestore-pagination';

// ─────────────────────────────────────────────────────────────────────────────
// Firestore mock. We simulate the cursor + limit contract:
//   - `getDocs(query)` returns pages of a fixed dataset in a stable order.
//   - `startAfter(lastDoc)` moves the cursor past `lastDoc`.
//   - `limit(n)` caps each page at n docs.
// The helper being tested passes constraints through `query(ref, ...)`;
// our mock records those constraints and slices the dataset accordingly.
// ─────────────────────────────────────────────────────────────────────────────

interface FakeDoc {
  id: string;
  data: { n: number; name: string };
}

let mockDataset: FakeDoc[] = [];

interface MockedQuery {
  startAfterIndex: number | null;
  pageLimit: number;
}

jest.mock('firebase/firestore', () => {
  return {
    getDocs: jest.fn((q: MockedQuery) => {
      const startAt = q.startAfterIndex !== null ? q.startAfterIndex + 1 : 0;
      const slice = mockDataset.slice(startAt, startAt + q.pageLimit);
      return Promise.resolve({
        empty: slice.length === 0,
        docs: slice.map((d, i) => ({
          id: d.id,
          data: () => d.data,
          _index: startAt + i,
        })),
      });
    }),
    query: (_ref: unknown, ...constraints: unknown[]): MockedQuery => {
      // Constraints arrive in the order the helper builds them: base first,
      // then optional startAfter, then limit. Pick them out by tag.
      const startAfterCon = constraints.find(
        (c) => (c as { __kind: string }).__kind === 'startAfter'
      ) as { __kind: string; index: number } | undefined;
      const limitCon = constraints.find(
        (c) => (c as { __kind: string }).__kind === 'limit'
      ) as { __kind: string; n: number } | undefined;

      return {
        startAfterIndex: startAfterCon ? startAfterCon.index : null,
        pageLimit: limitCon ? limitCon.n : mockDataset.length,
      };
    },
    startAfter: (lastDoc: { _index: number }) => ({
      __kind: 'startAfter',
      index: lastDoc._index,
    }),
    limit: (n: number) => ({ __kind: 'limit', n }),
    orderBy: (field: string, dir?: string) => ({ __kind: 'orderBy', field, dir }),
  };
});

function seedDataset(count: number): void {
  mockDataset = [];
  for (let i = 0; i < count; i++) {
    mockDataset.push({ id: `id-${i}`, data: { n: i, name: `row-${i}` } });
  }
}

const { orderBy } = jest.requireMock('firebase/firestore');

describe('paginateAll', () => {
  afterEach(() => {
    mockDataset = [];
  });

  it('returns an empty array when the collection is empty', async () => {
    seedDataset(0);
    const result = await paginateAll({} as never, [orderBy('n')]);
    expect(result).toEqual([]);
  });

  it('returns all docs from a small (< pageSize) collection in one page', async () => {
    seedDataset(50);
    const result = await paginateAll({} as never, [orderBy('n')], { pageSize: 500 });
    expect(result).toHaveLength(50);
    expect(result[0].id).toBe('id-0');
    expect(result[49].id).toBe('id-49');
  });

  it('returns EVERY doc when the collection is larger than one page (the bug we\'re fixing)', async () => {
    // This is the scale scenario. Old code with a single limit(10000) would
    // silently return only 10 000 out of 12 000. paginateAll must return all.
    seedDataset(12_000);
    const result = await paginateAll({} as never, [orderBy('n')], { pageSize: 500 });
    expect(result).toHaveLength(12_000);
    // Sanity: no duplicates, in order.
    expect(result[0].id).toBe('id-0');
    expect(result[11_999].id).toBe('id-11999');
  });

  it('honours the pageSize option', async () => {
    seedDataset(1_500);
    const result = await paginateAll({} as never, [orderBy('n')], { pageSize: 250 });
    expect(result).toHaveLength(1_500);
  });

  it('calls onProgress with the running total after each page', async () => {
    seedDataset(1_200);
    const progressTicks: number[] = [];
    await paginateAll({} as never, [orderBy('n')], {
      pageSize: 500,
      onProgress: (n) => progressTicks.push(n),
    });
    // 500 + 500 + 200 = three ticks.
    expect(progressTicks).toEqual([500, 1000, 1200]);
  });

  it('terminates correctly when the last page is exactly pageSize (boundary case)', async () => {
    // 1000 docs with pageSize 500 → two full pages, then an empty third read.
    // The helper must recognise "docs.length === pageSize" is not proof of
    // more data existing; it re-queries once and sees empty, then stops.
    seedDataset(1_000);
    const result = await paginateAll({} as never, [orderBy('n')], { pageSize: 500 });
    expect(result).toHaveLength(1_000);
  });
});

describe('paginateAllData', () => {
  afterEach(() => {
    mockDataset = [];
  });

  it('returns the .data() payloads instead of snapshots', async () => {
    seedDataset(3);
    const result = await paginateAllData<{ n: number; name: string }>(
      {} as never,
      [orderBy('n')],
    );
    expect(result).toEqual([
      { n: 0, name: 'row-0' },
      { n: 1, name: 'row-1' },
      { n: 2, name: 'row-2' },
    ]);
  });
});
