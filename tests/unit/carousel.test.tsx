// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, describe, expect, it } from "vitest";
import { Carousel } from "@/components/shared/Carousel";
import en from "../../messages/en.json";

beforeAll(() => {
  // jsdom has no ResizeObserver; the carousel only uses it to update arrow state.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe("Carousel", () => {
  it("renders one slot per real child and none for an absent (null) lead card", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Carousel headingId="h" title="New Arrivals">
          {null}
          <div>one</div>
          <div>two</div>
        </Carousel>
      </NextIntlClientProvider>,
    );
    const slots = container.querySelectorAll("ul > li");
    expect(slots).toHaveLength(2);
    expect([...slots].every((li) => li.textContent)).toBe(true);
  });
});
