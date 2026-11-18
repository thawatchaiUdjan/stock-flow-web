import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

// The row's "Actions for …" button, which the actions menu opens from.
export function menuButtonOf(row: HTMLElement) {
  return within(row).getByRole("button", { name: /^Actions for / });
}

// Opens a row's actions menu and returns it; its items are in a portal, so they are not "within" the row.
export async function openRowMenu(user: UserEvent, row: HTMLElement) {
  await user.click(menuButtonOf(row));
  return screen.findByRole("menu");
}
