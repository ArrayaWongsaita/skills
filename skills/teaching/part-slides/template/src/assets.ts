// Finds a visual's files by its key: src/illustrations/part-NN/<key>.tsx and src/assets/images/part-NN/<key>.(png|jpg|webp).
import type { ComponentType } from 'react';

export type IllustrationLoader = () => Promise<{ default: ComponentType }>;
export type AssetLookup = {
  illustration: (part: number, key: string) => IllustrationLoader | null;
  image: (part: number, key: string) => string | null;
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'webp'];
const slug = (part: number) => `part-${String(part).padStart(2, '0')}`;

export function makeAssetLookup(illustrations: Record<string, IllustrationLoader>, images: Record<string, string>): AssetLookup {
  return {
    illustration: (part, key) => illustrations[`./illustrations/${slug(part)}/${key}.tsx`] ?? null,
    image: (part, key) => {
      for (const extension of IMAGE_EXTENSIONS) {
        const url = images[`./assets/images/${slug(part)}/${key}.${extension}`];
        if (url) return url;
      }
      return null;
    },
  };
}

export const assets = makeAssetLookup(
  import.meta.glob<{ default: ComponentType }>('./illustrations/part-*/*.tsx'),
  import.meta.glob<string>('./assets/images/part-*/*.{png,jpg,webp}', { eager: true, query: '?url', import: 'default' }),
);
