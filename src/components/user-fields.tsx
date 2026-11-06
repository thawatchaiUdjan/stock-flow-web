import type { AnyFieldApi } from "@tanstack/react-form";

import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { assignableRoles } from "@/lib/roles";

export const fieldMessages = {
  name: "Enter a name.",
  email: "Enter a valid email address.",
  role: "Choose a Role.",
};

// The fields the create and edit forms have in common. `refused` is the API turning the field down.
export function NameField({ field, refused }: { field: AnyFieldApi; refused: boolean }) {
  const invalid = field.state.meta.errors.length > 0 || refused;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
      <Input
        id={field.name}
        autoComplete="off"
        aria-invalid={invalid}
        aria-describedby={invalid ? "name-error" : undefined}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      <FieldError id="name-error">{invalid ? fieldMessages.name : null}</FieldError>
    </Field>
  );
}

export function RoleField({ field, refused }: { field: AnyFieldApi; refused: boolean }) {
  const invalid = field.state.meta.errors.length > 0 || refused;

  return (
    <FieldSet data-invalid={invalid}>
      <FieldLegend variant="label">Role</FieldLegend>
      <RadioGroup
        aria-describedby={invalid ? "role-error" : undefined}
        value={field.state.value}
        onValueChange={(value) => field.handleChange(value)}
      >
        {assignableRoles.map(({ value, label }) => (
          <Field key={value} orientation="horizontal" data-invalid={invalid}>
            <RadioGroupItem value={value} id={`role-${value}`} aria-invalid={invalid} />
            <FieldLabel htmlFor={`role-${value}`} className="font-normal">
              {label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      <FieldError id="role-error">{invalid ? fieldMessages.role : null}</FieldError>
    </FieldSet>
  );
}
