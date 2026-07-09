"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

type ConfirmFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  confirmMessage?: string;
  getConfirmMessage?: (form: HTMLFormElement) => string;
  children: ReactNode;
};

export function ConfirmForm({
  confirmMessage,
  getConfirmMessage,
  children,
  ...formProps
}: ConfirmFormProps) {
  return (
    <form
      {...formProps}
      onSubmit={(e) => {
        const message =
          getConfirmMessage?.(e.currentTarget) ??
          confirmMessage ??
          "¿Confirmas esta acción?";
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
