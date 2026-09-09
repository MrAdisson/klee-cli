/** @type {import("prettier").Config} */
export default {
  singleQuote: true,
  semi: true,
  printWidth: 100,
  trailingComma: 'all',
  overrides: [
    {
      files: ['*.md'],
      options: { proseWrap: 'preserve' },
    },
  ],
};
