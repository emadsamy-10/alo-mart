"use server";

import { getLocale } from "next-intl/server";
import { getCities, getRegions } from "./api";
import type { Place } from "./schemas";

/** Regions/cities for the address form's dependent selects (public, cached data). */
export async function loadRegions(countryId: number): Promise<Place[] | null> {
  if (!Number.isInteger(countryId) || countryId <= 0) return [];
  const result = await getRegions(await getLocale(), countryId);
  return result.ok ? result.data : null;
}

export async function loadCities(regionId: number): Promise<Place[] | null> {
  if (!Number.isInteger(regionId) || regionId <= 0) return [];
  const result = await getCities(await getLocale(), regionId);
  return result.ok ? result.data : null;
}
