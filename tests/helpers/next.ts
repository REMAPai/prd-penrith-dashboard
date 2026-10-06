import { expect, vi } from "vitest";

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

type Entry = { value: string; opts?: Record<string, unknown> };

class FakeJar {
  store = new Map<string, Entry>();
  get = (name: string) => (this.store.has(name) ? { name, value: this.store.get(name)!.value } : undefined);
  has = (name: string) => this.store.has(name);
  set = vi.fn((name: string, value: string, opts?: Record<string, unknown>) => {
    this.store.set(name, { value, opts });
  });
  delete = vi.fn((name: string) => {
    this.store.delete(name);
  });
  options = (name: string) => this.store.get(name)?.opts;
  clear = () => this.store.clear();
}

export const jar = new FakeJar();

export const redirect = vi.fn((url: string): never => {
  throw new RedirectError(url);
});

export const nextHeadersMock = { cookies: async () => jar, headers: async () => new Headers() };
export const nextNavigationMock = { redirect, usePathname: vi.fn(() => "/"), notFound: vi.fn() };
export const nextCacheMock = { revalidatePath: vi.fn(), revalidateTag: vi.fn() };

export async function expectRedirect(p: Promise<unknown>, url: string) {
  await expect(p).rejects.toMatchObject({ url });
}
