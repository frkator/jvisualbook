import { defaultUrlTransform } from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// Chapter HTML is trusted, like the Java code in the same local notebook.
export const markdownRehypePlugins = [rehypeRaw];

export function markdownUrlTransform(url, key, node) {
  if (node.tagName === 'img' && key === 'src' &&
      /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+={0,2}$/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}
