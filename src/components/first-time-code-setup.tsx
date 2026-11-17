import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useEffect, useRef, useState } from "react";

import { errorMessage, hasCode, hasFieldError } from "@/api/errors";
import {
  useRequestFirstTimeCode,
  useSetEmailPassword,
  useVerifyFirstTimeCode,
} from "@/api/generated/email-access/email-access";
import { useCoolingDown } from "@/components/email-instructions";
import { EmailPasswordForm } from "@/components/email-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const codeLength = 6;

// users-and-access R27, R42, R54: the code step and the password it unlocks. `codeSent` is false when no new code went out.
export function FirstTimeCodeSetup({
  email,
  codeSent = true,
  onRestart,
  onDone,
}: {
  email: string;
  codeSent?: boolean;
  onRestart: () => void;
  onDone: () => void;
}) {
  // Successful sends, for the resend wait (users-and-access R43).
  const [sends, setSends] = useState(codeSent ? 1 : 0);
  // users-and-access R42: a grant authorizes password setup only, and survives no reload.
  const [grant, setGrant] = useState<string | null>(null);
  const request = useRequestFirstTimeCode({
    mutation: { gcTime: 0, onSuccess: () => setSends((count) => count + 1) },
  });
  const verify = useVerifyFirstTimeCode({
    mutation: { gcTime: 0, onSuccess: (result) => setGrant(result.token) },
  });
  const password = useSetEmailPassword({
    mutation: {
      gcTime: 0,
      onSuccess: () => {
        setGrant(null);
        onDone();
      },
    },
  });
  const invalidGrant = hasCode(password.error, "password-setup-invalid");

  if (grant) {
    return (
      <>
        {invalidGrant ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(password.error)}</AlertDescription>
          </Alert>
        ) : (
          <EmailPasswordForm
            email={email}
            save={(value) => password.mutate({ data: { token: grant, password: value } })}
            pending={password.isPending}
            error={password.error}
          />
        )}
        <Button variant="outline" disabled={password.isPending} onClick={onRestart}>
          Start password setup again
        </Button>
      </>
    );
  }
  return (
    <CodeStep
      email={email}
      sends={sends}
      request={request}
      verify={verify}
      changeEmail={onRestart}
    />
  );
}

function CodeStep({
  email,
  sends,
  request,
  verify,
  changeEmail,
}: {
  email: string;
  sends: number;
  request: ReturnType<typeof useRequestFirstTimeCode>;
  verify: ReturnType<typeof useVerifyFirstTimeCode>;
  changeEmail: () => void;
}) {
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const coolingDown = useCoolingDown(sends);
  const busy = verify.isPending || request.isPending;
  const invalidCode = hasFieldError(verify.error, "code");

  // The code step opens with its first box focused; a rejected code returns focus there.
  useEffect(() => {
    if (!busy) input.current?.focus();
  }, [busy, verify.error]);

  const error = (invalidCode ? null : verify.error) ?? request.error;

  return (
    <div className="flex flex-col gap-4">
      {error != null && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      {sends > 0 ? (
        // users-and-access R44: the same message whether or not the email is eligible.
        <output className="text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> is eligible, we've sent it
          a six-digit code. It expires after 10 minutes, and only the newest code works.
        </output>
      ) : (
        <output className="text-muted-foreground">
          No new code was sent to <span className="font-medium text-foreground">{email}</span>. A
          code sent earlier still works until it expires. You can also resend one.
        </output>
      )}
      <Field data-invalid={invalidCode}>
        <FieldLabel htmlFor="code">First-time code</FieldLabel>
        <InputOTP
          ref={input}
          id="code"
          maxLength={codeLength}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          disabled={busy}
          onChange={(value) => {
            setCode(value);
            verify.reset();
          }}
          // users-and-access R54: a complete code is verified without a button.
          onComplete={(value: string) => {
            if (!busy)
              verify.mutate({ data: { email, code: value } }, { onError: () => setCode("") });
          }}
          aria-invalid={invalidCode}
          aria-describedby={invalidCode ? "code-error" : undefined}
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: codeLength }, (_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                aria-invalid={invalidCode}
                className="size-11 rounded-md border text-base first:rounded-l-md last:rounded-r-md shell:size-9.5 shell:text-body"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {verify.isPending && <FieldDescription>Checking code</FieldDescription>}
        {invalidCode && (
          <FieldError id="code-error">Enter the six-digit code from your email.</FieldError>
        )}
      </Field>
      <p className="text-muted-foreground">
        Didn't get it?{" "}
        <Button
          variant="link"
          className="h-auto p-0"
          disabled={busy || coolingDown}
          onClick={() => request.mutate({ data: { email } })}
        >
          Resend code
        </Button>
      </p>
      <Button
        variant="link"
        className="h-auto min-h-6 self-start p-0"
        disabled={busy}
        onClick={changeEmail}
      >
        Change email
      </Button>
    </div>
  );
}
