// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppImage } from "@/components/shared/AppImage";

describe("AppImage fallback", () => {
  it("keeps the aspect box and announces the alt text when the image is missing", () => {
    const { container } = render(<AppImage src={null} alt="Oasis desk" ratio="4/5" fallbackLabel="No image available" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.aspectRatio).toBe("4/5");
    expect(screen.getByRole("img", { name: "Oasis desk" })).toBeInTheDocument();
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });

  it("hides decorative fallbacks from assistive tech", () => {
    const { container } = render(<AppImage src="" alt="" ratio="1/1" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("rejects unsafe URLs instead of rendering them", () => {
    render(<AppImage src="javascript:alert(1)" alt="x" ratio="1/1" />);
    expect(document.querySelector("img")).toBeNull();
  });
});
