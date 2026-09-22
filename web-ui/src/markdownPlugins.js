import rehypeRaw from 'rehype-raw';

// Chapter HTML is trusted, like the Java code in the same local notebook.
export const markdownRehypePlugins = [rehypeRaw];
