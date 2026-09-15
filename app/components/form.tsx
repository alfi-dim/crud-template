import type { AnyFieldApi } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-form";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";
import { useFetcher, useFormAction, useNavigation, useSubmit } from "react-router";
import type * as z from "zod";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Field as UiField,
  FieldContent as UiFieldContent,
  FieldDescription,
  FieldError as UiFieldError,
  FieldLabel as UiFieldLabel,
  FieldSet as UiFieldSet,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { revalidateLogic, useAppForm } from "~/components/ui/tanstack-form";
import { cn } from "~/lib/utils";

export type FormActionResult = {
  ok: boolean;
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

type FieldName<TValues> = Extract<keyof TValues, string>;

type Option = {
  label: string;
  value: string;
  disabled?: boolean;
};

type BaseFieldConfig<TValues> = {
  name: FieldName<TValues>;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

type InputFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "text" | "email" | "tel" | "url" | "number";
  placeholder?: string;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
};

type PasswordFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "password";
  placeholder?: string;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
};

type TextareaFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "textarea";
  placeholder?: string;
  rows?: number;
};

type SelectFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "select";
  placeholder?: string;
  options: readonly Option[];
};

type CheckboxFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "checkbox";
};

export type CustomFieldRenderContext = {
  field: AnyFieldApi;
  id: string;
  serverError?: string;
  clearServerErrors: () => void;
};

type CustomFieldConfig<TValues> = BaseFieldConfig<TValues> & {
  type: "custom";
  render: (context: CustomFieldRenderContext) => React.ReactNode;
};

export type FormFieldConfig<TValues> =
  | InputFieldConfig<TValues>
  | PasswordFieldConfig<TValues>
  | TextareaFieldConfig<TValues>
  | SelectFieldConfig<TValues>
  | CheckboxFieldConfig<TValues>
  | CustomFieldConfig<TValues>;

export type ConfigFormProps<TValues extends Record<string, unknown>> = Readonly<{
  title: string;
  description?: string;
  target?: string;
  defaultValues?: TValues;
  schema: z.ZodType<unknown, TValues>;
  fields: readonly FormFieldConfig<TValues>[];
  actionData?: FormActionResult;
  submissionMode?: "navigation" | "fetcher";
  submitLabel?: string;
  submittingLabel?: string;
  resetLabel?: string;
  showReset?: boolean;
  resetOnSuccess?: boolean;
  className?: string;
  fieldsClassName?: string;
  footer?: React.ReactNode;
  onReset?: () => void;
  onSuccess?: (result: FormActionResult) => void;
}>;

type RouterSubmitTarget = Parameters<ReturnType<typeof useSubmit>>[0];

export function ConfigurableForm<TValues extends Record<string, unknown>>({
  title,
  description,
  target,
  defaultValues,
  schema,
  fields,
  actionData,
  submissionMode = "navigation",
  submitLabel = "Submit",
  submittingLabel = "Submitting...",
  resetLabel = "Reset",
  showReset = true,
  resetOnSuccess = false,
  className,
  fieldsClassName,
  footer,
  onReset,
  onSuccess,
}: ConfigFormProps<TValues>) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher<FormActionResult>();
  const resolvedAction = useFormAction(target);

  const serverResult = submissionMode === "fetcher" ? fetcher.data : actionData;
  const [errorState, setErrorState] = React.useState<{
    result: FormActionResult | undefined;
    editedFields: Set<string>;
    hideAll: boolean;
    hideFormError: boolean;
  }>({ result: undefined, editedFields: new Set(), hideAll: false, hideFormError: false });
  const currentErrors = errorState.result === serverResult;
  const showServerErrors = !currentErrors || !errorState.hideAll;
  const showFormError = showServerErrors && (!currentErrors || !errorState.hideFormError);

  const hideServerErrors = () => {
    setErrorState({
      result: serverResult,
      editedFields: new Set(),
      hideAll: true,
      hideFormError: true,
    });
  };

  const clearServerError = React.useCallback(
    (name: string) => {
      setErrorState((previous) => ({
        result: serverResult,
        editedFields: new Set([
          ...(previous.result === serverResult ? previous.editedFields : []),
          name,
        ]),
        hideAll: previous.result === serverResult && previous.hideAll,
        hideFormError: true,
      }));
    },
    [serverResult],
  );

  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "blur",
    }),
    validators: {
      onDynamic: schema,
    },
    onSubmit: ({ value }) => {
      hideServerErrors();
      const payload = value as unknown as RouterSubmitTarget;

      const options = {
        method: "post" as const,
        action: target,
        encType: "application/json" as const,
      };

      if (submissionMode === "fetcher") {
        void fetcher.submit(payload, options);
        return;
      }

      void submit(payload, options);
    },
    onSubmitInvalid: () => {
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    },
  });

  const isDefault = useSelector(form.store, (state) => state.isDefaultValue);
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const isOwnNavigation = Boolean(
    navigation.formMethod &&
    navigation.formAction &&
    new URL(navigation.formAction).href === new URL(resolvedAction).href,
  );
  const isBusy =
    submissionMode === "fetcher"
      ? fetcher.state !== "idle"
      : isOwnNavigation && navigation.state !== "idle";

  const handleSuccess = React.useEffectEvent((result: FormActionResult) => {
    if (resetOnSuccess) form.reset();
    onSuccess?.(result);
  });

  React.useEffect(() => {
    if (serverResult?.ok === true) handleSuccess(serverResult);
  }, [serverResult]);

  const handleReset = () => {
    form.reset();
    hideServerErrors();
    if (submissionMode === "fetcher") fetcher.reset();
    onReset?.();
  };

  return (
    <div ref={rootRef} className={cn("w-full", className)}>
      <form.AppForm>
        <form.Form action={resolvedAction}>
          <header className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description ? <FieldDescription>{description}</FieldDescription> : null}
          </header>

          {showFormError && serverResult?.formError ? (
            <p role="alert" className="text-destructive text-sm">
              {serverResult.formError}
            </p>
          ) : null}

          <div className={cn("grid gap-4", fieldsClassName)}>
            {fields.map((config) => (
              <form.AppField key={config.name} name={config.name as never}>
                {(field) => (
                  <ConfiguredField
                    config={config}
                    field={field as unknown as AnyFieldApi}
                    serverError={
                      showServerErrors &&
                      (!currentErrors || !errorState.editedFields.has(config.name))
                        ? serverResult?.fieldErrors?.[config.name]?.[0]
                        : undefined
                    }
                    clearServerErrors={() => clearServerError(config.name)}
                  />
                )}
              </form.AppField>
            ))}
          </div>

          <footer className="flex w-full items-center justify-end gap-3 pt-3">
            {footer}
            {showReset && !isDefault ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleReset}
              >
                {resetLabel}
              </Button>
            ) : null}
            <Button type="submit" disabled={isBusy || !canSubmit}>
              {isBusy ? <Spinner /> : null}
              {isBusy ? submittingLabel : submitLabel}
            </Button>
          </footer>
        </form.Form>
      </form.AppForm>
    </div>
  );
}

function ConfiguredField<TValues extends Record<string, unknown>>({
  config,
  field,
  serverError,
  clearServerErrors,
}: Readonly<{
  config: FormFieldConfig<TValues>;
  field: AnyFieldApi;
  serverError?: string;
  clearServerErrors: () => void;
}>) {
  const id = React.useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const clientError = field.state.meta.isTouched
    ? getErrorMessage(field.state.meta.errors[0])
    : undefined;
  const error = serverError ?? clientError;
  const invalid = Boolean(error);
  const describedBy = [config.description ? descriptionId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  const change = React.useCallback(
    (value: unknown) => {
      clearServerErrors();
      field.handleChange(value);
    },
    [clearServerErrors, field],
  );

  if (config.type === "custom") {
    return (
      <div className={config.className}>
        {config.render({
          field,
          id,
          serverError,
          clearServerErrors,
        })}
      </div>
    );
  }

  if (config.type === "checkbox") {
    return (
      <UiFieldSet className={config.className}>
        <UiField orientation="horizontal" data-invalid={invalid}>
          <Checkbox
            id={id}
            checked={Boolean(field.state.value)}
            aria-required={config.required}
            disabled={config.disabled}
            aria-invalid={invalid}
            aria-describedby={describedBy || undefined}
            onBlur={field.handleBlur}
            onCheckedChange={change}
          />
          <UiFieldContent>
            <UiFieldLabel htmlFor={id}>
              {config.label}
              {config.required ? " *" : null}
            </UiFieldLabel>
            {config.description ? (
              <FieldDescription id={descriptionId}>{config.description}</FieldDescription>
            ) : null}
            <ConfiguredFieldError id={errorId} message={error} />
          </UiFieldContent>
        </UiField>
      </UiFieldSet>
    );
  }

  let control: React.ReactNode;

  if (config.type === "select") {
    control = (
      <Select
        value={String(field.state.value ?? "")}
        disabled={config.disabled}
        onValueChange={change}
        onOpenChange={(open) => {
          if (!open) field.handleBlur();
        }}
      >
        <SelectTrigger
          aria-required={config.required}
          id={id}
          className="w-full"
          aria-invalid={invalid}
          aria-describedby={describedBy || undefined}
        >
          <SelectValue placeholder={config.placeholder}>
            {config.options.find((option) => option.value === field.state.value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {config.options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (config.type === "textarea") {
    control = (
      <Textarea
        id={id}
        name={field.name}
        value={String(field.state.value ?? "")}
        placeholder={config.placeholder}
        rows={config.rows}
        required={config.required}
        disabled={config.disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onBlur={field.handleBlur}
        onChange={(event) => change(event.target.value)}
      />
    );
  } else if (config.type === "password") {
    control = (
      <PasswordInput
        id={id}
        name={field.name}
        value={String(field.state.value ?? "")}
        placeholder={config.placeholder}
        autoComplete={config.autoComplete}
        required={config.required}
        disabled={config.disabled}
        invalid={invalid}
        aria-describedby={describedBy || undefined}
        onBlur={field.handleBlur}
        onChange={change}
      />
    );
  } else {
    control = (
      <Input
        id={id}
        name={field.name}
        type={config.type}
        value={String(field.state.value ?? "")}
        placeholder={config.placeholder}
        autoComplete={config.autoComplete}
        required={config.required}
        disabled={config.disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy || undefined}
        onBlur={field.handleBlur}
        onChange={(event) => change(getInputValue(event, config.type))}
      />
    );
  }

  return (
    <UiFieldSet className={cn("w-full", config.className)}>
      <UiField data-invalid={invalid}>
        <UiFieldLabel htmlFor={id}>
          {config.label}
          {config.required ? " *" : null}
        </UiFieldLabel>

        {control}

        {config.description ? (
          <FieldDescription id={descriptionId}>{config.description}</FieldDescription>
        ) : null}
      </UiField>

      <ConfiguredFieldError id={errorId} message={error} />
    </UiFieldSet>
  );
}

function getInputValue(
  event: React.ChangeEvent<HTMLInputElement>,
  type: InputFieldConfig<Record<string, unknown>>["type"],
) {
  if (type !== "number") return event.target.value;
  if (event.target.value === "") return undefined;
  return event.target.valueAsNumber;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return undefined;
}

function PasswordInput({
  invalid,
  onChange,
  ...props
}: Readonly<
  Omit<React.ComponentProps<typeof InputGroupInput>, "type" | "onChange"> & {
    invalid: boolean;
    onChange: (value: string) => void;
  }
>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        {...props}
        type={visible ? "text" : "password"}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
      <InputGroupAddon align="inline-end">
        <button
          type="button"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </InputGroupAddon>
    </InputGroup>
  );
}

function ConfiguredFieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  if (!message) return null;

  return <UiFieldError id={id} errors={[{ message }]} />;
}
