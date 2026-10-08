import { screen } from "@testing-library/react";
import { App } from "./App";
import { renderWithProviders } from "./test/render";

describe("App", () => {
  it("renders the workspace dashboard", async () => {
    renderWithProviders(<App />);

    expect(
      await screen.findByRole("heading", { name: "SyncSpace Product" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "In Review" }),
    ).toBeInTheDocument();
  });

  it("renders a routed document", async () => {
    renderWithProviders(<App />, "/documents/doc-roadmap");

    expect(await screen.findByDisplayValue("Product Roadmap")).toBeInTheDocument();
    expect(screen.getByText("planning")).toBeInTheDocument();
  });
});
