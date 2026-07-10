"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

type ConfirmFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  /** Mensaje fijo de confirmación. */
  confirmMessage?: string;
  /**
   * Plantilla con placeholders `{campo}` rellenados desde el formulario al enviar.
   * Usa `{__selectLabel:nombreSelect}` para el texto de la opción seleccionada.
   */
  confirmTemplate?: string;
  /** Valores estáticos para placeholders que no vienen del formulario. */
  confirmFields?: Record<string, string>;
  children: ReactNode;
};

function resolveConfirmMessage(
  form: HTMLFormElement,
  template: string,
  fields: Record<string, string>,
): string {
  const formData = new FormData(form);

  return template.replace(/\{([^}]+)\}/g, (match, key: string) => {
    if (key.startsWith("__selectLabel:")) {
      const selectName = key.slice("__selectLabel:".length);
      const select = form.elements.namedItem(selectName) as HTMLSelectElement | null;
      const label = select?.selectedOptions[0]?.text?.replace(/\s*\([^)]*\)$/, "").trim();
      return label || "—";
    }
    if (fields[key] !== undefined) return fields[key];
    const value = formData.get(key);
    return value != null ? String(value) : match;
  });
}

export function ConfirmForm({
  confirmMessage,
  confirmTemplate,
  confirmFields = {},
  children,
  ...formProps
}: ConfirmFormProps) {
  return (
    <form
      {...formProps}
      onSubmit={(e) => {
        const message = confirmTemplate
          ? resolveConfirmMessage(e.currentTarget, confirmTemplate, confirmFields)
          : confirmMessage ?? "¿Confirmas esta acción?";
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
