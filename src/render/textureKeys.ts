export function celestialVariantIndex(entityId: number, variantsPerTier: number): number {
  return ((entityId % variantsPerTier) + variantsPerTier) % variantsPerTier;
}

export function celestialVariantKey(tierId: string, variantIndex: number): string {
  return `celestial-${tierId}-v${variantIndex}`;
}
