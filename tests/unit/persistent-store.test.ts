// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPersistentStore } from "@/lib/persistent-store";

const parse = (raw: unknown) => (Array.isArray(raw) ? (raw as number[]) : []);

describe("persistent store modes", () => {
  beforeEach(() => window.localStorage.clear());

  it("local mode reads and writes storage", () => {
    const store = createPersistentStore<number[]>("test_key", [], parse);
    store.set([1, 2]);
    expect(JSON.parse(window.localStorage.getItem("test_key")!)).toEqual([1, 2]);
    expect(store.get()).toEqual([1, 2]);
  });

  it("memory mode never touches storage and leaves guest data intact", () => {
    window.localStorage.setItem("test_key", "[7]");
    const store = createPersistentStore<number[]>("test_key", [], parse);
    expect(store.readLocal()).toEqual([7]);

    store.setMode("memory", [100]);
    expect(store.get()).toEqual([100]);
    store.set([100, 200]);
    expect(store.get()).toEqual([100, 200]);
    expect(window.localStorage.getItem("test_key")).toBe("[7]");

    // Back to guest: account data is gone, storage is read again.
    store.setMode("local");
    expect(store.get()).toEqual([7]);
  });

  it("clearLocal removes the guest data (after it moved into the account)", () => {
    window.localStorage.setItem("test_key", "[7]");
    const store = createPersistentStore<number[]>("test_key", [], parse);
    store.setMode("memory", [1]);
    store.clearLocal();
    expect(window.localStorage.getItem("test_key")).toBeNull();
    expect(store.get()).toEqual([1]);
    store.setMode("local");
    expect(store.get()).toEqual([]);
  });

  it("notifies subscribers on mode changes", () => {
    const store = createPersistentStore<number[]>("test_key", [], parse);
    let calls = 0;
    store.subscribe(() => calls++);
    store.setMode("memory", [1]);
    store.setMode("local");
    expect(calls).toBe(2);
  });
});
