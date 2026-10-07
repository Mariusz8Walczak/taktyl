"use client";
// B-102, B-111 (docs/04 par. 4): pola atrybutow wg kategorii, typowane (liczby, listy, tak/nie) z jednostkami w etykietach.
// Wartosci sa walidowane schematem kategorii z @taktyl/contracts; blad stoi pod polem (aria-describedby, aria-invalid).
import type { CategoryId } from "@taktyl/contracts";
import { Field } from "@taktyl/ui";
import { useFormContext } from "react-hook-form";
import {
  ATTRIBUTE_FIELDS,
  getFieldError,
  PAD_SIZE_KEYS,
  PAD_TYPE_OPTIONS,
  type AttrDesc,
} from "../../lib/product-form";

export interface AttributesFieldsProps {
  category: CategoryId;
  disabled?: boolean;
  /** Klucze rozmiarow podkladki, ktore produkt ma (nie dodajemy ani nie usuwamy rozmiarow w tym formularzu). */
  padSizes?: readonly string[];
}

export function AttributesFields({ category, disabled, padSizes = [] }: AttributesFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const err = (path: string) => getFieldError(errors, path);

  const render = (d: AttrDesc) => {
    const name = `attributes.${d.key}`;
    switch (d.kind) {
      case "text":
        return (
          <Field
            key={d.key}
            label={d.label}
            hint={d.hint}
            disabled={disabled}
            error={err(name)}
            {...register(name)}
          />
        );
      case "nulltext":
        return (
          <Field
            key={d.key}
            label={d.label}
            hint={d.hint}
            disabled={disabled}
            error={err(name)}
            {...register(name, {
              setValueAs: (v: string | null) => (v === "" || v === null ? null : v),
            })}
          />
        );
      case "int":
        return (
          <Field
            key={d.key}
            label={d.label}
            type="number"
            inputMode="numeric"
            disabled={disabled}
            error={err(name)}
            {...register(name, { valueAsNumber: true })}
          />
        );
      case "select":
        return (
          <Field
            key={d.key}
            as="select"
            label={d.label}
            disabled={disabled}
            error={err(name)}
            {...register(name)}
          >
            {d.options?.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </Field>
        );
      case "bool":
        return (
          <div key={d.key} className="adm-stos">
            <label className="adm-radio">
              <input type="checkbox" disabled={disabled} {...register(name)} />
              <span>{d.label}</span>
            </label>
          </div>
        );
      case "multi":
        return (
          <fieldset key={d.key} aria-describedby={err(name) ? `${name}-blad` : undefined}>
            <legend className="tk-pole__etykieta">{d.label}</legend>
            {d.options?.map((o) => (
              <label key={o.v} className="adm-radio">
                <input type="checkbox" value={o.v} disabled={disabled} {...register(name)} />
                <span>{o.l}</span>
              </label>
            ))}
            {err(name) ? (
              <p id={`${name}-blad`} className="tk-pole__blad">
                {err(name)}
              </p>
            ) : null}
          </fieldset>
        );
      case "dims":
        return (
          <fieldset key={d.key} className="adm-siatka adm-siatka--pelna">
            <legend className="tk-pole__etykieta">{d.label}</legend>
            {(["w", "d", "h"] as const).map((axis, i) => (
              <Field
                key={axis}
                label={["Szerokość", "Głębokość", "Wysokość"][i] as string}
                type="number"
                inputMode="numeric"
                disabled={disabled}
                error={err(`${name}.${axis}`)}
                {...register(`${name}.${axis}`, { valueAsNumber: true })}
              />
            ))}
          </fieldset>
        );
      case "handcm":
        return (
          <fieldset key={d.key} className="adm-siatka adm-siatka--pelna">
            <legend className="tk-pole__etykieta">{d.label}</legend>
            {[0, 1].map((i) => (
              <Field
                key={i}
                label={i === 0 ? "Od (cm)" : "Do (cm)"}
                type="number"
                step="0.1"
                inputMode="decimal"
                disabled={disabled}
                error={err(`${name}.${i}`)}
                {...register(`${name}.${i}`, { valueAsNumber: true })}
              />
            ))}
          </fieldset>
        );
    }
  };

  return (
    <div className="adm-siatka">
      {ATTRIBUTE_FIELDS[category].map(render)}
      {category === "podkladki" && padSizes.length > 0 ? (
        <div className="adm-siatka adm-siatka--pelna">
          {PAD_SIZE_KEYS.filter((k) => padSizes.includes(k)).map((k) => (
            <fieldset key={k} className="adm-karta">
              <legend className="tk-pole__etykieta">Rozmiar {k.toUpperCase()}</legend>
              <div className="adm-siatka">
                <Field
                  label="Etykieta"
                  disabled={disabled}
                  error={err(`attributes.sizes.${k}.label`)}
                  {...register(`attributes.sizes.${k}.label`)}
                />
                <Field
                  label="Szerokość (mm)"
                  type="number"
                  inputMode="numeric"
                  disabled={disabled}
                  error={err(`attributes.sizes.${k}.w`)}
                  {...register(`attributes.sizes.${k}.w`, { valueAsNumber: true })}
                />
                <Field
                  label="Głębokość (mm)"
                  type="number"
                  inputMode="numeric"
                  disabled={disabled}
                  error={err(`attributes.sizes.${k}.d`)}
                  {...register(`attributes.sizes.${k}.d`, { valueAsNumber: true })}
                />
                <Field
                  as="select"
                  label="Przeznaczenie"
                  disabled={disabled}
                  error={err(`attributes.sizes.${k}.type`)}
                  {...register(`attributes.sizes.${k}.type`)}
                >
                  {PAD_TYPE_OPTIONS.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </Field>
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  );
}
