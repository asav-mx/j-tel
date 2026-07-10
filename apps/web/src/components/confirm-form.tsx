"use client";

import { useState, type FormHTMLAttributes, type ReactNode } from "react";

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
  /** Texto del botón mientras espera la respuesta del servidor. */
  pendingLabel?: string;
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
  pendingLabel = "Procesando…",
  children,
  ...formProps
}: ConfirmFormProps) {
  const [pending, setPending] = useState(false);

  return (
    <form
      {...formProps}
      aria-busy={pending || undefined}
      onSubmit={(e) => {
        if (pending) {
          e.preventDefault();
          return;
        }
        const message = confirmTemplate
          ? resolveConfirmMessage(e.currentTarget, confirmTemplate, confirmFields)
          : confirmMessage ?? "¿Confirmas esta acción?";
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        setPending(true);
        const form = e.currentTarget;
        for (const el of Array.from(form.elements)) {
          if (
            el instanceof HTMLButtonElement ||
            (el instanceof HTMLInputElement && el.type === "submit")
          ) {
            el.disabled = true;
            if (el instanceof HTMLButtonElement && el.type === "submit") {
              el.dataset.idleLabel = el.textContent ?? "";
              el.textContent = pendingLabel;
            }
          }
        }
      }}
    >
      {children}
      {pending ? (
        <p className="mt-2 text-xs text-amber-200/90" role="status">
          {pendingLabel} No cierres ni pulses otra vez — puede tardar un momento.
        </p>
      ) : null}
    </form>
  );
}
