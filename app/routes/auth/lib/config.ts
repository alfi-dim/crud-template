import * as z from "zod";
import type { FormFieldConfig } from "~/components/form";
export const loginSchema = z.object({
  email: z.email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

export const loginField: FormFieldConfig<z.infer<typeof loginSchema>>[] = [
  {
    type: "email",
    autoComplete: "username",
    name: "email",
    label: "Email",
    placeholder: "Enter your email",
    required: true,
  },
  {
    type: "password",
    autoComplete: "current-password",
    name: "password",
    label: "Password",
    placeholder: "Enter your password",
    required: true,
  },
];
