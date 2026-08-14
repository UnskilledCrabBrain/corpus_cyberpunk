import { t } from "../i18n.mjs?v=0.6.37";
import { hackingFeature } from "./hacking.mjs?v=0.6.37";

export const ACTOR_FEATURES = [
  hackingFeature
].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

export function actorFeatureSchema() {
  return Object.fromEntries(
    ACTOR_FEATURES
      .filter((feature) => feature.actorSchema)
      .map((feature) => {
        try {
          return [feature.id, feature.actorSchema()];
        } catch (error) {
          console.error(`Corpus | Failed to build actor feature schema: ${feature.id}`, error);
          return null;
        }
      })
      .filter(Boolean)
  );
}

export function prepareActorFeatureData(system) {
  for (const feature of ACTOR_FEATURES) {
    feature.prepareDerivedData?.(system);
  }
}

export async function prepareActorFeatureTabs(actor, activeTab) {
  return Promise.all(
    ACTOR_FEATURES.map(async (feature) => {
      const label = t(feature.label.key, feature.label.fallback);
      let prepared;

      try {
        prepared = await feature.prepareActorTab(actor, { activeTab });
      } catch (error) {
        console.error(`Corpus | Failed to render actor feature tab: ${feature.id}`, error);
        prepared = {
          panelClass: "feature-error-panel",
          content: `<p class="empty">${foundry.utils.escapeHTML(t(
            "CORPUS.Features.RenderFailed",
            { en: "Feature failed to render.", ru: "Вкладка не загрузилась." }
          ))}</p>`
        };
      }

      return {
        id: feature.id,
        icon: feature.icon,
        order: feature.order ?? 100,
        label,
        active: feature.id === activeTab,
        template: feature.template,
        ...prepared
      };
    })
  );
}
