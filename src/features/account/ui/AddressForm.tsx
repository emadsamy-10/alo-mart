"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { saveAddressAction } from "../actions";
import { IDLE } from "../form-state";
import { loadCities, loadRegions } from "../geo-actions";
import type { Address, Place } from "../schemas";
import { CheckboxField, FormAlert, SelectField, SubmitButton, TextField } from "./fields";

interface AddressFormProps {
  countries: Place[];
  address?: Address | null;
  /** Prefilled lists for editing (the saved country's regions, region's cities). */
  regions?: Place[];
  cities?: Place[];
  defaults: { name: string; phone: string | null };
  /** Whether this would be the first address (it becomes the default anyway). */
  first: boolean;
  /** Safe return path after saving (e.g. back to checkout). */
  next?: string;
}

/**
 * Create/edit a delivery address. Region and city lists come from the API for
 * the chosen country/region (only active places), so a combination the API
 * would reject cannot be picked. Saving re-validates everything server-side.
 */
export function AddressForm({ countries, address, regions: initialRegions = [], cities: initialCities = [], defaults, first, next }: AddressFormProps) {
  const t = useTranslations("Account.addresses");
  const [state, action] = useActionState(saveAddressAction, IDLE);
  const v = state.values;
  const e = state.fieldErrors ?? {};

  const [countryId, setCountryId] = useState(v?.country_id ?? String(address?.country?.id ?? (countries.length === 1 ? countries[0].id : "")));
  const [regionId, setRegionId] = useState(v?.region_id ?? String(address?.region?.id ?? ""));
  const [cityId, setCityId] = useState(v?.city_id ?? String(address?.city?.id ?? ""));
  const [regions, setRegions] = useState<Place[]>(initialRegions);
  const [cities, setCities] = useState<Place[]>(initialCities);
  const [geoError, setGeoError] = useState(false);
  const [loading, startLoading] = useTransition();

  const pickCountry = (value: string) => {
    setCountryId(value);
    setRegionId("");
    setCityId("");
    setRegions([]);
    setCities([]);
    if (!value) return;
    startLoading(async () => {
      const list = await loadRegions(Number(value));
      setGeoError(list === null);
      setRegions(list ?? []);
    });
  };

  const pickRegion = (value: string) => {
    setRegionId(value);
    setCityId("");
    setCities([]);
    if (!value) return;
    startLoading(async () => {
      const list = await loadCities(Number(value));
      setGeoError(list === null);
      setCities(list ?? []);
    });
  };

  // An inactive saved place is not in the active lists: keep it selectable so editing other fields still works.
  const withSaved = (list: Place[], saved: Place | null | undefined, selected: string) =>
    saved && String(saved.id) === selected && !list.some((p) => p.id === saved.id) ? [saved, ...list] : list;

  const field = (name: keyof Address & string) => v?.[name] ?? (address?.[name] as string | null | undefined) ?? "";

  return (
    <form action={action} noValidate className="space-y-6" data-testid="address-form">
      <FormAlert state={state} />
      {address ? <input type="hidden" name="address_id" value={address.id} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <fieldset className="space-y-5">
        <legend className="mb-4 text-base font-bold">{t("recipient")}</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField name="recipient_name" label={t("recipientName")} autoComplete="name" required maxLength={150} defaultValue={v?.recipient_name ?? address?.recipient_name ?? defaults.name} error={e.recipient_name} />
          <TextField
            name="recipient_phone"
            type="tel"
            label={t("recipientPhone")}
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            required
            maxLength={30}
            defaultValue={v?.recipient_phone ?? address?.recipient_phone ?? defaults.phone ?? ""}
            error={e.recipient_phone}
          />
        </div>
        <TextField name="label" label={t("label")} optional maxLength={50} placeholder={t("labelPlaceholder")} defaultValue={field("label")} error={e.label} />
      </fieldset>

      <fieldset className="space-y-5" aria-busy={loading}>
        <legend className="mb-4 text-base font-bold">{t("location")}</legend>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SelectField name="country_id" label={t("country")} required autoComplete="country" value={countryId} onChange={(ev) => pickCountry(ev.target.value)} error={e.country_id}>
            <option value="">{t("choose")}</option>
            {withSaved(countries, address?.country, countryId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="region_id"
            label={t("region")}
            required
            autoComplete="address-level1"
            value={regionId}
            disabled={!countryId || loading}
            onChange={(ev) => pickRegion(ev.target.value)}
            error={e.region_id}
          >
            <option value="">{loading && !regions.length ? t("loading") : t("choose")}</option>
            {withSaved(regions, address?.region, regionId).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="city_id"
            label={t("city")}
            required
            autoComplete="address-level2"
            value={cityId}
            disabled={!regionId || loading}
            onChange={(ev) => setCityId(ev.target.value)}
            error={e.city_id}
          >
            <option value="">{loading && regionId && !cities.length ? t("loading") : t("choose")}</option>
            {withSaved(cities, address?.city, cityId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div aria-live="polite" className="text-sm">
          {geoError ? <p className="text-danger">{t("geoError")}</p> : null}
          {!loading && !geoError && countryId && regions.length === 0 && !address?.region ? <p className="text-muted-foreground">{t("noRegions")}</p> : null}
          {!loading && !geoError && regionId && cities.length === 0 && !address?.city ? <p className="text-muted-foreground">{t("noCities")}</p> : null}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-4 text-base font-bold">{t("street")}</legend>
        <TextField name="address_line_1" label={t("line1")} autoComplete="address-line1" required maxLength={255} defaultValue={field("address_line_1")} error={e.address_line_1} />
        <TextField name="address_line_2" label={t("line2")} autoComplete="address-line2" optional maxLength={255} defaultValue={field("address_line_2")} error={e.address_line_2} />
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          <TextField name="building" label={t("building")} optional maxLength={50} defaultValue={field("building")} error={e.building} />
          <TextField name="floor" label={t("floor")} optional maxLength={20} defaultValue={field("floor")} error={e.floor} />
          <TextField name="unit" label={t("unit")} optional maxLength={50} defaultValue={field("unit")} error={e.unit} />
        </div>
        <TextField name="postal_code" label={t("postalCode")} autoComplete="postal-code" optional maxLength={20} dir="ltr" defaultValue={field("postal_code")} error={e.postal_code} className="sm:max-w-xs" />
        <div className="space-y-1.5">
          <label htmlFor="delivery_instructions" className="text-sm font-semibold">
            {t("instructions")} <span className="text-xs font-normal text-muted-foreground">({t("optional")})</span>
          </label>
          <textarea
            id="delivery_instructions"
            name="delivery_instructions"
            maxLength={500}
            rows={3}
            defaultValue={field("delivery_instructions")}
            className="block w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base shadow-sm hover:border-border-strong focus:border-brand focus:outline-none"
          />
        </div>
      </fieldset>

      {first ? (
        <p className="text-sm text-muted-foreground">{t("firstIsDefault")}</p>
      ) : address?.is_default ? null : (
        <CheckboxField name="make_default" label={t("makeDefault")} />
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Link href={next ?? "/account/addresses"} className={buttonClass({ variant: "outline", size: "lg" })}>
          {t("cancel")}
        </Link>
        <SubmitButton pendingLabel={t("saving")}>{address ? t("saveChanges") : t("save")}</SubmitButton>
      </div>
    </form>
  );
}
