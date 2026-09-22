import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import * as React from "react";

import { cn } from "~/lib/utils";

const { fieldContext, formContext, useFormContext } = createFormHookContexts();

function Form({
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"form">, "onSubmit" | "noValidate"> & {
  children?: React.ReactNode;
}) {
  const form = useFormContext();
  const handleSubmit = React.useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit();
    },
    [form],
  );

  return (
    <form
      {...props}
      method="post"
      onSubmit={handleSubmit}
      className={cn("flex flex-col p-2 md:p-5 w-full mx-auto gap-2", props.className)}
      noValidate
    >
      {children}
    </form>
  );
}

const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {},
  formComponents: { Form },
});

export { useAppForm };
