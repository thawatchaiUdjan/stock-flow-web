import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

// Drive the labelled calendar, including its public month/year navigation.
export async function chooseDate(user: UserEvent, label: string, value: string) {
  await user.click(screen.getByLabelText(label, { exact: true }));
  const target = new Date(`${value}T12:00:00Z`);
  const dialog = screen.getByRole("dialog", { name: `${label} calendar` });
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const targetMonth = monthName.format(target);
  while (!within(dialog).queryByRole("grid", { name: targetMonth })) {
    const shown = new Date(`1 ${within(dialog).getByRole("grid").getAttribute("aria-label")}`);
    const difference =
      (target.getUTCFullYear() - shown.getFullYear()) * 12 +
      target.getUTCMonth() -
      shown.getMonth();
    await user.click(
      within(dialog).getByRole("button", {
        name:
          Math.abs(difference) >= 12
            ? difference > 0
              ? "Next year"
              : "Previous year"
            : difference > 0
              ? /next month/i
              : /previous month/i,
      }),
    );
  }
  const dayName = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(target);
  // DayPicker's English day labels add ordinal suffixes.
  const dayPattern = dayName.replace(/(\d+),/, "$1(?:st|nd|rd|th),");
  await user.click(within(dialog).getByRole("button", { name: new RegExp(dayPattern) }));
}
