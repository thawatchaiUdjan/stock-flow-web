import { screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import { mockApi, productOf } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";

it("opens Adjust stock directly and cancels back to the filtered history", async () => {
  mockApi.session = "live";
  mockApi.role = "owner";
  mockApi.products = [
    productOf({ id: 1, name: "Helmet", sku: "HLM", unit: "pcs", price: 100, stock: 18 }),
  ];
  const { user, router } = renderApp("/stock-movements/adjust?productId=1&kind=receive");
  expect(await screen.findByRole("heading", { name: "Adjust stock" })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(await screen.findByRole("heading", { name: "Stock movements" })).toBeInTheDocument();
  expect(router.state.location.search).toMatchObject({ productId: 1, kind: "receive" });
});
